// app/api/vendor/activate/verify/route.ts
// ISS-OTP PR5 (vendors) — verify activation OTP, set PIN, start vendor session.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyOtp, isOtpEnabled } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';
import { issueVendorSession, vendorSessionCookie } from '@/lib/vendor-auth';

export const runtime = 'nodejs';

const PIN_RE = /^\d{4,6}$/;

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP is unavailable right now.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { portal_email?: string; code?: string; new_pin?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const email = (body.portal_email ?? '').trim().toLowerCase();
  const code = (body.code ?? '').trim();
  const newPin = (body.new_pin ?? '').trim();
  if (!email || !code) return NextResponse.json({ error: 'portal_email and code required' }, { status: 400 });
  if (!PIN_RE.test(newPin)) return NextResponse.json({ error: 'New PIN must be 4 to 6 digits' }, { status: 400 });

  const { data: vendors } = await supabaseAdmin
    .from('vendors')
    .select('id, name, contact_phone, school_id, institution_id')
    .eq('portal_email', email)
    .eq('has_portal_access', true)
    .eq('is_active', true);

  if (!vendors || vendors.length !== 1) return NextResponse.json({ error: 'Invalid email or no portal access.' }, { status: 401 });
  const v = vendors[0];
  if (!v.contact_phone) return NextResponse.json({ error: 'No registered phone on file. Please contact your school admin.' }, { status: 400 });

  const phone = normalisePhone(v.contact_phone) ?? v.contact_phone;
  const result = await verifyOtp({ phone, purpose: 'activation', code });
  if (!result.ok) return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });

  const hash = await bcrypt.hash(newPin, 10);
  const { error } = await supabaseAdmin.from('vendors').update({ access_pin_hashed: hash }).eq('id', v.id);
  if (error) {
    console.error('[vendor/activate/verify] set PIN failed:', error.message);
    return NextResponse.json({ error: 'Could not set PIN. Please try again.' }, { status: 500 });
  }

  const token = await issueVendorSession({ id: v.id, name: v.name, school_id: v.school_id, institution_id: v.institution_id });
  const res = NextResponse.json({ success: true, redirectTo: '/vendor' });
  res.cookies.set(vendorSessionCookie(token, process.env.NODE_ENV === 'production'));
  return res;
}
