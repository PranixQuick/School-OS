// app/api/auth/staff/activate/request/route.ts
// ISS-OTP PR5 (staff) — request an activation OTP for an un-provisioned staff login.
//
// Staff (and every shared-login role: principal, admin_staff, teacher, accountant,
// librarian, hod, meo, deo, registrar, dean, ...) authenticate with email+password
// via Supabase. This lets a staff member self-activate via phone OTP instead of an
// authority running activate-login. Only un-provisioned accounts (auth_user_id null)
// receive an OTP. Generic response (no enumeration); 503 when OTP disabled.

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

  let body: { phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const rawPhone = (body.phone ?? '').trim();
  if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

  const phone = normalisePhone(rawPhone) ?? rawPhone;
  const variants = Array.from(new Set([phone, rawPhone]));

  const generic = NextResponse.json({ success: true, message: 'If your number is registered and not yet activated, an OTP has been sent.' });

  // Resolve staff by phone, then the linked school_users login.
  const { data: staffRows } = await supabaseAdmin
    .from('staff').select('id, school_id').in('phone', variants).eq('is_active', true).limit(1);
  const st = staffRows?.[0];
  if (!st) { console.warn('[staff/activate/request] no staff for', maskPhone(phone)); return generic; }

  const { data: su } = await supabaseAdmin
    .from('school_users').select('id, auth_user_id, is_active').eq('staff_id', st.id).maybeSingle();
  if (!su || su.is_active === false) return generic;
  if (su.auth_user_id) return generic; // already provisioned — use login / OTP reset

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('phone_otp').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', since);
  if ((count ?? 0) < MAX_PER_PHONE) {
    await requestOtp({ phone, purpose: 'activation', schoolId: st.school_id });
  }

  return generic;
}
