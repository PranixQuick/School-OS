// app/api/student/activate/request/route.ts
// ISS-OTP PR5 (students) — request an activation OTP.
//
// Students have no phone of their own; the OTP is sent to the registered parent
// phone (students.phone_parent). admission_number resolves the student using the
// same single-match / multi-school logic as /api/student/login.
// Generic response (no enumeration) except the multi-school hint (mirrors login).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requestOtp, isOtpEnabled, maskPhone } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';

export const runtime = 'nodejs';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_PHONE = 3;

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP is unavailable right now. Please contact your school admin.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { admission_number?: string; school_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const admission = (body.admission_number ?? '').trim();
  const schoolId = (body.school_id ?? '').trim() || undefined;
  if (!admission) return NextResponse.json({ error: 'admission_number required' }, { status: 400 });

  let q = supabaseAdmin
    .from('students')
    .select('id, school_id, phone_parent')
    .eq('admission_number', admission)
    .eq('is_active', true)
    .eq('student_login_enabled', true);
  if (schoolId) q = q.eq('school_id', schoolId);
  const { data: matches } = await q;

  if (matches && matches.length > 1) {
    return NextResponse.json({ error: 'Multiple schools match. Please provide your school ID.', code: 'MULTI_SCHOOL' }, { status: 409 });
  }

  const generic = NextResponse.json({ success: true, message: 'If your record is found, an OTP has been sent to your registered parent number.' });

  const st = matches?.[0];
  if (!st || !st.phone_parent) {
    console.warn('[student/activate/request] no student/phone for admission', admission);
    return generic;
  }

  const phone = normalisePhone(st.phone_parent) ?? st.phone_parent;
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('phone_otp')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', since);
  if ((count ?? 0) < MAX_PER_PHONE) {
    await requestOtp({ phone, purpose: 'activation', schoolId: st.school_id });
  } else {
    console.warn('[student/activate/request] rate-limited', maskPhone(phone));
  }

  return generic;
}
