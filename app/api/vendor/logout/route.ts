// app/api/vendor/logout/route.ts
// ISS-7 (#7) — Clear the vendor_session cookie.

import { NextResponse } from 'next/server';
import { clearedVendorSessionCookie } from '@/lib/vendor-auth';

export const runtime = 'nodejs';

export async function POST() {
  const isProduction = process.env.NODE_ENV === 'production';
  const res = NextResponse.json({ success: true });
  res.cookies.set(clearedVendorSessionCookie(isProduction));
  return res;
}
