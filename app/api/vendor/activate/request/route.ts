// app/api/vendor/activate/request/route.ts
// ISS-OTP PR5 (vendors) — request an activation OTP for a vendor portal login.
//
// Vendors sign in with portal_email + PIN; the OTP is sent to their contact_phone.
// Only vendors with portal access granted (has_portal_access) are eligible.
// Generic response (no enumeration); 503 when OTP disabled.

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

  let body: { portal_email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const email = (body.portal_email ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'portal_email required' }, { status: 400 });

  const generic = NextResponse.json({ success: true, message: 'If your vendor account is found, an OTP has been sent to your registered number.' });

  const { data: vendors } = await supabaseAdmin
    .from('vendors')
    .select('id, contact_phone, school_id')
    .eq('portal_email', email)
    .eq('has_portal_access', true)
    .eq('is_active', true);

  if (!vendors || vendors.length !== 1) { console.warn('[vendor/activate/request] no unique vendor for', email); return generic; }
  const v = vendors[0];
  if (!v.contact_phone) return generic;

  const phone = normalisePhone(v.contact_phone) ?? v.contact_phone;
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('phone_otp').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', since);
  if ((count ?? 0) < MAX_PER_PHONE) {
    await requestOtp({ phone, purpose: 'activation', schoolId: v.school_id });
  } else {
    console.warn('[vendor/activate/request] rate-limited', maskPhone(phone));
  }

  return generic;
}
