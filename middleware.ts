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
  '/api/cron',
  '/parent',
  '/api/parent',
  '/student',
  '/api/student',
  '/api/transport',
  '/api/whatsapp',
  '/api/webhooks',
  '/sitemap.xml',
  '/robots.txt',
  '/manifest.json',
  '/api/og',
  '/sw.js',
  '/offline.html',
  '/icons',
];

// Paths requiring @pranixailabs.com email — checked with startsWith
// so /super-admin/ops-dashboard, /super-admin/anything is also protected
const SUPER_ADMIN_PREFIX = '/super-admin';
const SUPER_ADMIN_EMAIL_SUFFIX = '@pranixailabs.com';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
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
    // Clear stale/invalid cookie so browser stops sending it
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

  // Super-admin path protection — startsWith catches all sub-routes
  if (pathname.startsWith(SUPER_ADMIN_PREFIX)) {
    const email = (session.userEmail ?? '').toLowerCase();
    if (!email.endsWith(SUPER_ADMIN_EMAIL_SUFFIX)) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Inject session context headers for API routes
  const res = NextResponse.next();
  res.headers.set('x-school-id', session.schoolId ?? '');
  res.headers.set('x-user-role', session.userRole ?? '');
  res.headers.set('x-user-email', session.userEmail ?? '');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|sw.js|offline.html|icons/).*)'],
};
