// app/api/vendor/login/route.ts
// ISS-7 (#7) — Vendor portal login: portal_email + PIN -> vendor_session cookie.

import { NextRequest, NextResponse } from 'next/server';
import { verifyVendorPin, issueVendorSession, vendorSessionCookie } from '@/lib/vendor-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { portal_email?: string; pin?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.portal_email || !body.pin) {
    return NextResponse.json({ error: 'portal_email and pin are required' }, { status: 400 });
  }

  const vendor = await verifyVendorPin(body.portal_email, body.pin);
  if (!vendor) return NextResponse.json({ error: 'Invalid email or PIN' }, { status: 401 });

  const token = await issueVendorSession(vendor);
  const isProduction = process.env.NODE_ENV === 'production';

  const res = NextResponse.json({ name: vendor.name, redirectTo: '/vendor' });
  res.cookies.set(vendorSessionCookie(token, isProduction));
  return res;
}
