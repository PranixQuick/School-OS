import { NextRequest, NextResponse } from 'next/server';
import {
  clientIpFromRequest,
  getSession,
  logAuthEvent,
} from '@/lib/auth';
import { SESSION_COOKIE, revokeSession } from '@/lib/session';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  await revokeSession();

  await logAuthEvent({
    eventType: 'logout',
    schoolId: session?.schoolId,
    userId: session?.userId,
    email: session?.userEmail,
    ip: clientIpFromRequest(req),
    userAgent: req.headers.get('user-agent'),
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
