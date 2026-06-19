// app/api/parent/login-otp/verify/route.ts
// ISS-OTP PR6 (parents) — passwordless login: verify OTP and start session.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyOtp, isOtpEnabled } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';
import { signParentSession, parentSessionCookieOptions } from '@/lib/parent-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP sign-in is unavailable right now.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { phone?: string; code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const rawPhone = (body.phone ?? '').trim();
  const code = (body.code ?? '').trim();
  if (!rawPhone || !code) return NextResponse.json({ error: 'phone and code required' }, { status: 400 });

  const phone = normalisePhone(rawPhone) ?? rawPhone;
  const variants = Array.from(new Set([phone, rawPhone]));

  const result = await verifyOtp({ phone, purpose: 'login', code });
  if (!result.ok) return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });

  const { data: parents } = await supabaseAdmin
    .from('parents').select('id, school_id, student_id').in('phone', variants).eq('is_active', true);
  if (!parents || parents.length === 0) {
    return NextResponse.json({ error: 'No parent account found for this number.' }, { status: 404 });
  }
  const p = parents[0];

  await supabaseAdmin.from('parents').update({ last_access: new Date().toISOString() }).eq('id', p.id);

  const token = await signParentSession({ parentId: p.id, schoolId: p.school_id, studentId: p.student_id, phone });
  const res = NextResponse.json({ success: true, redirectTo: '/parent' });
  const opts = parentSessionCookieOptions();
  res.cookies.set(opts.name, token, opts);
  return res;
}
