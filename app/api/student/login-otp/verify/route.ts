// app/api/student/login-otp/verify/route.ts
// ISS-OTP PR6 (students) — passwordless login: verify OTP and start session.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyOtp, isOtpEnabled } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';
import { issueStudentSession, studentSessionCookie } from '@/lib/student-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP sign-in is unavailable right now.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { admission_number?: string; school_id?: string; code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const admission = (body.admission_number ?? '').trim();
  const schoolId = (body.school_id ?? '').trim() || undefined;
  const code = (body.code ?? '').trim();
  if (!admission || !code) return NextResponse.json({ error: 'admission_number and code required' }, { status: 400 });

  let q = supabaseAdmin
    .from('students').select('id, name, class, section, school_id, phone_parent')
    .eq('admission_number', admission).eq('is_active', true).eq('student_login_enabled', true);
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data: matches } = await q;

  if (!matches?.length) return NextResponse.json({ error: 'Invalid admission number.' }, { status: 401 });
  if (matches.length > 1) {
    return NextResponse.json({ error: 'Multiple schools match. Please provide your school ID.', code: 'MULTI_SCHOOL' }, { status: 409 });
  }
  const st = matches[0];
  if (!st.phone_parent) return NextResponse.json({ error: 'No registered phone on file. Please contact your school admin.' }, { status: 400 });

  const phone = normalisePhone(st.phone_parent) ?? st.phone_parent;
  const result = await verifyOtp({ phone, purpose: 'login', code });
  if (!result.ok) return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });

  const token = await issueStudentSession({
    id: st.id, name: st.name, class: st.class, section: st.section, school_id: st.school_id,
  });
  const res = NextResponse.json({ success: true, name: st.name, redirectTo: '/student' });
  res.cookies.set(studentSessionCookie(token, process.env.NODE_ENV === 'production'));
  return res;
}
