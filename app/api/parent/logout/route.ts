import { NextRequest, NextResponse } from 'next/server';
import { revokeParentSession } from '@/lib/parent-auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('parent_session')?.value;
  await revokeParentSession(token);

  const res = NextResponse.json({ success: true });
  res.cookies.set('parent_session', '', {
    maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/',
  });
  return res;
}
