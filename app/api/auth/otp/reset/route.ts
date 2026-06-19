// app/api/auth/otp/reset/route.ts
// ISS-OTP PR4 (spec §6.4) — complete a credential reset after OTP proof.
//
// Flow: client calls /otp/request {purpose:'reset'} -> /otp/verify -> receives a
// short-lived proof token -> POST here with {token, role, new credential}.
//
// Role is explicit (a phone can belong to more than one role); we never auto-pick.
//   parent / vendor / student -> new bcrypt PIN (access_pin_hashed)
//   staff                     -> new Supabase password (auth.admin.updateUserById)
// Student: a parent phone can map to several children -> require student_id then.
//
// Augments (does not replace) the email-only forgot-password. Fail-safe: 503 when
// OTP disabled. Note: the OTP itself is single-use (consumed at /verify); the proof
// token is short-lived (10 min) and only obtainable by the phone owner.

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isOtpEnabled } from '@/lib/otp';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const PIN_RE = /^\d{4,6}$/;
const ROLES = new Set(['parent', 'student', 'vendor', 'staff']);

function phoneVariants(p: string): string[] {
  const digits = (p || '').replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return Array.from(new Set([p, digits, '+' + digits, last10, '+91' + last10, '91' + last10].filter(Boolean)));
}

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP is not enabled.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { token?: string; role?: string; new_pin?: string; new_password?: string; student_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const role = (body.role ?? '').trim();
  if (!body.token || !ROLES.has(role)) {
    return NextResponse.json({ error: 'token and a valid role are required' }, { status: 400 });
  }

  // Verify the proof-of-phone token (must be purpose=reset).
  let phone: string;
  try {
    const { payload } = await jwtVerify(body.token, new TextEncoder().encode(env.SESSION_SECRET), { issuer: 'edprosys-otp' });
    if (payload.purpose !== 'reset' || typeof payload.phone !== 'string') {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 401 });
    }
    phone = payload.phone;
  } catch {
    return NextResponse.json({ error: 'Reset token is invalid or expired' }, { status: 401 });
  }

  const variants = phoneVariants(phone);

  // ── PIN roles ──────────────────────────────────────────────────────────────
  if (role === 'parent' || role === 'vendor' || role === 'student') {
    const newPin = (body.new_pin ?? '').trim();
    if (!PIN_RE.test(newPin)) {
      return NextResponse.json({ error: 'New PIN must be 4 to 6 digits' }, { status: 400 });
    }
    const hash = await bcrypt.hash(newPin, 10);

    if (role === 'parent') {
      const { data: rows, error } = await supabaseAdmin
        .from('parents')
        .update({ access_pin_hashed: hash, access_pin: null })
        .in('phone', variants).eq('is_active', true)
        .select('id');
      if (error) return NextResponse.json({ error: 'Could not reset PIN. Please try again.' }, { status: 500 });
      if (!rows || rows.length === 0) return NextResponse.json({ error: 'No account found for this number.' }, { status: 404 });
      return NextResponse.json({ success: true, updated: rows.length });
    }

    if (role === 'vendor') {
      const { data: rows, error } = await supabaseAdmin
        .from('vendors')
        .update({ access_pin_hashed: hash })
        .in('contact_phone', variants).eq('is_active', true)
        .select('id');
      if (error) return NextResponse.json({ error: 'Could not reset PIN. Please try again.' }, { status: 500 });
      if (!rows || rows.length === 0) return NextResponse.json({ error: 'No account found for this number.' }, { status: 404 });
      return NextResponse.json({ success: true, updated: rows.length });
    }

    // student — keyed on the parent phone; resolve target child/children
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id')
      .in('phone_parent', variants).eq('is_active', true).eq('student_login_enabled', true);
    if (!students || students.length === 0) {
      return NextResponse.json({ error: 'No student login found for this number.' }, { status: 404 });
    }
    let ids = students.map((s) => s.id);
    if (body.student_id) {
      if (!ids.includes(body.student_id)) {
        return NextResponse.json({ error: 'Student is not linked to this number.' }, { status: 403 });
      }
      ids = [body.student_id];
    } else if (students.length > 1) {
      return NextResponse.json(
        { error: 'multiple_students', student_ids: ids, message: 'Multiple students are linked to this number; specify student_id.' },
        { status: 409 }
      );
    }
    const { error } = await supabaseAdmin
      .from('students')
      .update({ access_pin_hashed: hash, access_pin: null })
      .in('id', ids);
    if (error) return NextResponse.json({ error: 'Could not reset PIN. Please try again.' }, { status: 500 });
    return NextResponse.json({ success: true, updated: ids.length });
  }

  // ── Staff -> Supabase password ───────────────────────────────────────────────
  const newPassword = body.new_password ?? '';
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }
  const { data: staffRows } = await supabaseAdmin
    .from('staff').select('id').in('phone', variants).eq('is_active', true).limit(1);
  const staffRow = staffRows?.[0];
  if (!staffRow) return NextResponse.json({ error: 'No staff account found for this number.' }, { status: 404 });

  const { data: su } = await supabaseAdmin
    .from('school_users').select('auth_user_id, is_active').eq('staff_id', staffRow.id).maybeSingle();
  if (!su || !su.auth_user_id) {
    return NextResponse.json({ error: 'Password login is not enabled for this account.' }, { status: 400 });
  }

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(su.auth_user_id, { password: newPassword });
  if (updErr) {
    console.error('[otp/reset] staff password update failed:', updErr.message);
    return NextResponse.json({ error: 'Could not reset password. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
