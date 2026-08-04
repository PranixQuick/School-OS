// app/api/vendor/logout/route.ts
// ISS-7 (#7) — Clear the vendor_session cookie.

import { NextRequest, NextResponse } from 'next/server';
import { clearedVendorSessionCookie, revokeVendorSession, VENDOR_SESSION_COOKIE } from '@/lib/vendor-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(VENDOR_SESSION_COOKIE)?.value;
  await revokeVendorSession(token);

  const isProduction = process.env.NODE_ENV === 'production';
  const res = NextResponse.json({ success: true });
  res.cookies.set(clearedVendorSessionCookie(isProduction));
  return res;
}
