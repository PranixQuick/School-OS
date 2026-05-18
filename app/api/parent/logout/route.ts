import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('parent_session', '', {
    maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/',
  });
  return res;
}
