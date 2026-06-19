// app/api/parent/verify-otp/route.ts
// ISS-OTP PR5 (parents) — verify the activation OTP and start a session.
//
// REPLACES the previous plaintext `access_pin === otp` compare + hand-rolled
// JSON `parent_session` cookie. Now:
//   * verifies via the shared verifyOtp (purpose=activation): TTL + attempt cap +
//     single-use, bcrypt-hashed code in phone_otp;
//   * ensures a parents row per matched student (no name clobber);
//   * issues the real jose-signed parent session (signParentSession) that
//     getParentSession accepts.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyOtp, isOtpEnabled } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';
import { signParentSession, parentSessionCookieOptions } from '@/lib/parent-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP registration is unavailable right now.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { phone?: string; otp?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const rawPhone = (body.phone ?? '').trim();
  const otp = (body.otp ?? '').trim();
  if (!rawPhone || !otp) return NextResponse.json({ error: 'Phone and OTP required' }, { status: 400 });

  const phone = normalisePhone(rawPhone) ?? rawPhone;

  const result = await verifyOtp({ phone, purpose: 'activation', code: otp });
  if (!result.ok) {
    return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });
  }

  // Find the student(s) for this parent phone.
  const variants = Array.from(new Set([phone, rawPhone]));
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, school_id, parent_name')
    .or(variants.map((v) => `phone_parent.eq.${v}`).join(','))
    .eq('is_active', true);

  if (!students || students.length === 0) {
    return NextResponse.json({ error: 'No student found for this number. Please contact your school admin.' }, { status: 404 });
  }

  // Ensure a parents row per matched student — never clobber an existing name.
  let primary: { id: string; school_id: string; student_id: string } | null = null;
  for (const st of students) {
    const { data: existing } = await supabaseAdmin
      .from('parents')
      .select('id')
      .eq('school_id', st.school_id)
      .eq('student_id', st.id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from('parents').update({ last_access: new Date().toISOString() }).eq('id', existing.id);
      if (!primary) primary = { id: existing.id, school_id: st.school_id, student_id: st.id };
    } else {
      const { data: created } = await supabaseAdmin
        .from('parents')
        .insert({ school_id: st.school_id, student_id: st.id, name: st.parent_name || 'Parent', phone, last_access: new Date().toISOString() })
        .select('id')
        .single();
      if (created && !primary) primary = { id: created.id, school_id: st.school_id, student_id: st.id };
    }
  }

  if (!primary) {
    return NextResponse.json({ error: 'Could not activate the parent account. Please try again.' }, { status: 500 });
  }

  const token = await signParentSession({
    parentId: primary.id,
    schoolId: primary.school_id,
    studentId: primary.student_id,
    phone,
  });

  const res = NextResponse.json({ success: true, student_name: students[0].name });
  const opts = parentSessionCookieOptions();
  res.cookies.set(opts.name, token, opts);
  return res;
}
