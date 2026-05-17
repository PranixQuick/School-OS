import { NextRequest, NextResponse } from 'next/server';
import {
  clientIpFromRequest,
  getSession,
  logAuthEvent,
} from '@/lib/auth';
import { SESSION_COOKIE, revokeSession } from '@/lib/session';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await getSession(req);
  const ip = clientIpFromRequest(req);

  // AG-5: pass the raw token so revokeSession can extract userId+iat
  // and write to the revoked_sessions denylist. Fail-silent — the cookie
  // is always cleared regardless of whether the DB write succeeds.
  await revokeSession(token, { reason: 'logout', ip: ip ?? undefined });

  await logAuthEvent({
    eventType: 'logout',
    schoolId: session?.schoolId,
    userId: session?.userId,
    email: session?.userEmail,
    ip,
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
