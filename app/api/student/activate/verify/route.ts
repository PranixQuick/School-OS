// app/api/student/activate/verify/route.ts
// ISS-OTP PR5 (students) — verify activation OTP, set PIN, start session.
//
// Resolves the student by admission_number (+ school_id when ambiguous), verifies
// the OTP that was sent to the parent phone (purpose=activation) via the shared
// service, sets the student's bcrypt PIN, and issues the student session.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyOtp, isOtpEnabled } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';
import { issueStudentSession, studentSessionCookie } from '@/lib/student-auth';

export const runtime = 'nodejs';

const PIN_RE = /^\d{4,6}$/;

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP is unavailable right now.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { admission_number?: string; school_id?: string; code?: string; new_pin?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const admission = (body.admission_number ?? '').trim();
  const schoolId = (body.school_id ?? '').trim() || undefined;
  const code = (body.code ?? '').trim();
  const newPin = (body.new_pin ?? '').trim();
  if (!admission || !code) return NextResponse.json({ error: 'admission_number and code required' }, { status: 400 });
  if (!PIN_RE.test(newPin)) return NextResponse.json({ error: 'New PIN must be 4 to 6 digits' }, { status: 400 });

  let q = supabaseAdmin
    .from('students')
    .select('id, name, class, section, school_id, phone_parent')
    .eq('admission_number', admission)
    .eq('is_active', true)
    .eq('student_login_enabled', true);
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data: matches } = await q;

  if (!matches?.length) return NextResponse.json({ error: 'Invalid admission number.' }, { status: 401 });
  if (matches.length > 1) {
    return NextResponse.json({ error: 'Multiple schools match. Please provide your school ID.', code: 'MULTI_SCHOOL' }, { status: 409 });
  }
  const st = matches[0];
  if (!st.phone_parent) {
    return NextResponse.json({ error: 'No registered phone on file. Please contact your school admin.' }, { status: 400 });
  }

  const phone = normalisePhone(st.phone_parent) ?? st.phone_parent;
  const result = await verifyOtp({ phone, purpose: 'activation', code });
  if (!result.ok) {
    return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });
  }

  const hash = await bcrypt.hash(newPin, 10);
  const { error } = await supabaseAdmin
    .from('students')
    .update({ access_pin_hashed: hash, access_pin: null })
    .eq('id', st.id);
  if (error) {
    console.error('[student/activate/verify] set PIN failed:', error.message);
    return NextResponse.json({ error: 'Could not set PIN. Please try again.' }, { status: 500 });
  }

  const token = await issueStudentSession({
    id: st.id, name: st.name, class: st.class, section: st.section, school_id: st.school_id,
  });
  const res = NextResponse.json({ success: true, name: st.name, redirectTo: '/student' });
  res.cookies.set(studentSessionCookie(token, process.env.NODE_ENV === 'production'));
  return res;
}
