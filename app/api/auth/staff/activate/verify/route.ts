// app/api/auth/staff/activate/verify/route.ts
// ISS-OTP PR5 (staff) — verify activation OTP and provision the Supabase login.
//
// Mirrors the provisioning in /api/admin/staff/activate-login, but self-service:
// proven by phone-OTP rather than an authority. Creates (or repairs) the Supabase
// Auth user with the chosen password, links auth_user_id, flips invite_status to
// 'verified'. Does NOT mint a session here — the user signs in at /login with
// their email + new password.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyOtp, isOtpEnabled } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';

export const runtime = 'nodejs';

async function findAuthUserByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP is unavailable right now.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { phone?: string; code?: string; new_password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const rawPhone = (body.phone ?? '').trim();
  const code = (body.code ?? '').trim();
  const newPassword = body.new_password ?? '';
  if (!rawPhone || !code) return NextResponse.json({ error: 'phone and code required' }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });

  const phone = normalisePhone(rawPhone) ?? rawPhone;
  const variants = Array.from(new Set([phone, rawPhone]));

  const result = await verifyOtp({ phone, purpose: 'activation', code });
  if (!result.ok) return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });

  const { data: staffRows } = await supabaseAdmin
    .from('staff').select('id, school_id, name').in('phone', variants).eq('is_active', true).limit(1);
  const st = staffRows?.[0];
  if (!st) return NextResponse.json({ error: 'No staff account found for this number.' }, { status: 404 });

  const { data: su } = await supabaseAdmin
    .from('school_users').select('id, email, auth_user_id, is_active').eq('staff_id', st.id).maybeSingle();
  if (!su || su.is_active === false) return NextResponse.json({ error: 'Account not found or inactive.' }, { status: 404 });
  if (su.auth_user_id) {
    return NextResponse.json({ error: 'This login is already active. Please sign in with your email and password.', code: 'ALREADY_ACTIVE' }, { status: 409 });
  }

  const email = (su.email ?? '').toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'No email on file for this account. Contact your school admin.' }, { status: 400 });

  // Provision the Supabase Auth user with the chosen password (email pre-confirmed).
  let authUserId: string | null = null;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: newPassword,
    email_confirm: true,
    user_metadata: { school_id: st.school_id, school_user_id: su.id, name: st.name },
  });
  if (createErr) {
    // Recover a half-provisioned auth user (created by an earlier invite).
    const existingId = await findAuthUserByEmail(email);
    if (!existingId) {
      console.error('[staff/activate/verify] createUser failed:', createErr.message);
      return NextResponse.json({ error: 'Could not activate login. Please contact your school admin.' }, { status: 500 });
    }
    await supabaseAdmin.auth.admin.updateUserById(existingId, { password: newPassword });
    authUserId = existingId;
  } else {
    authUserId = created.user?.id ?? null;
  }
  if (!authUserId) return NextResponse.json({ error: 'Could not activate login. Please try again.' }, { status: 500 });

  await supabaseAdmin.from('school_users').update({ auth_user_id: authUserId, invite_status: 'verified' }).eq('id', su.id);

  return NextResponse.json({ success: true, email, message: 'Login activated. Please sign in with your email and new password.' });
}
