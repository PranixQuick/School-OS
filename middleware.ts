import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

// Fully public — no auth required
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/pricing',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/callback',
  '/api/auth/magic-link',
  '/api/schools/create',
  '/api/health',
  '/api/cron',           // CRON_SECRET-guarded cron endpoints
  '/parent',
  '/api/parent',
  '/api/whatsapp',       // Twilio webhook — must be public (no session cookie)
];

// Super admin only paths
const SUPER_ADMIN_PATHS = ['/admin'];
const SUPER_ADMIN_EMAIL = 'pranixailabs@gmail.com';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static files
  if (
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(loginUrl);
    // Clear any stale/invalid cookie so the browser doesn't keep sending it.
    if (token) {
      res.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
    }
    return res;
  }

  // Super admin path protection
  if (SUPER_ADMIN_PATHS.some(p => pathname.startsWith(p))) {
    if (session.userEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Inject headers for API routes
  const res = NextResponse.next();
  res.headers.set('x-school-id', session.schoolId ?? '');
  res.headers.set('x-user-role', session.userRole ?? '');
  res.headers.set('x-user-email', session.userEmail ?? '');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
