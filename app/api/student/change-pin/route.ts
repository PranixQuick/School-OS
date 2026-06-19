// app/api/student/change-pin/route.ts
// ISS-1 (#1 / P4.6) — Student self-service PIN change.
//
// POST { current_pin, new_pin }
//   1. Requires a valid student session (cookie).
//   2. Verifies the current PIN against access_pin_hashed (or legacy plaintext).
//   3. Stores a fresh bcrypt hash and clears any legacy plaintext PIN.
//
// Additive; no schema change. Mirrors the parent change-PIN flow.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStudentSession, studentAuthResponse } from '@/lib/student-auth';

export const runtime = 'nodejs';

const PIN_RE = /^\d{4,6}$/;

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireStudentSession(req); }
  catch (e) { return studentAuthResponse(e); }

  let body: { current_pin?: string; new_pin?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const current = (body.current_pin ?? '').trim();
  const next = (body.new_pin ?? '').trim();

  if (!current || !next) {
    return NextResponse.json({ error: 'Current and new PIN are required' }, { status: 400 });
  }
  if (!PIN_RE.test(next)) {
    return NextResponse.json({ error: 'New PIN must be 4 to 6 digits' }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: 'New PIN must be different from the current PIN' }, { status: 400 });
  }

  const { data: student, error: selErr } = await supabaseAdmin
    .from('students')
    .select('id, access_pin, access_pin_hashed, is_active, student_login_enabled')
    .eq('id', session.studentId)
    .eq('school_id', session.schoolId)
    .maybeSingle();

  if (selErr || !student) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }
  if (student.is_active === false || student.student_login_enabled === false) {
    return NextResponse.json({ error: 'Login is disabled for this account' }, { status: 403 });
  }

  let valid = false;
  if (student.access_pin_hashed) valid = await bcrypt.compare(current, student.access_pin_hashed);
  else if (student.access_pin) valid = student.access_pin === current;
  if (!valid) {
    return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
  }

  const hashed = await bcrypt.hash(next, 10);
  const { error: updErr } = await supabaseAdmin
    .from('students')
    .update({ access_pin_hashed: hashed, access_pin: null })
    .eq('id', session.studentId);

  if (updErr) {
    console.error('[student change-pin] update failed:', updErr.message);
    return NextResponse.json({ error: 'Could not update PIN. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'PIN updated.' });
}
