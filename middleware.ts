import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/session';

// Fully public — no auth required
//
// Item #1 Track C: /teacher and /api/teacher were previously in this list
// (phone+PIN-per-request anti-pattern from prior Items 9-13). They have been
// removed so the new session-based teacher flow runs through the same
// verifySession/redirect-to-login pipeline as admin and principal routes.
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
  // '/teacher' and '/api/teacher' removed in Item #1 Track C — now session-protected
  '/student',
  '/api/student',       // Batch 4D: student_session self-managed, not school_session
  '/api/transport',      // K6: Bus GPS device pings — device token auth (no session cookie)
  '/api/whatsapp',       // Twilio webhook — must be public (no session cookie)
  '/api/webhooks',      // Item #13: Razorpay webhook — must be public (raw body verification)
  '/sitemap.xml',       // PR-5: SEO crawlers must reach sitemap without auth redirect
  '/robots.txt',        // PR-5: SEO crawlers
  '/manifest.json',     // PR-5: PWA manifest
  '/api/og',            // PR-5: OG image generation for social previews
  '/sw.js',             // PR-5: Service worker registration
  '/offline.html',      // PR-5: PWA offline fallback
  '/icons',             // PR-5: PWA icon assets directory
];

// Super admin only paths
const SUPER_ADMIN_PATHS = ['/super-admin'];
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'pranixailabs@gmail.com';

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
    // TODO(item-15): unauthenticated /api/* requests currently 302 to /login HTML. Should return 401 JSON. Deferred to Item #15.
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
  if (SUPER_ADMIN_PATHS.some(p => pathname === p)) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|sw.js|offline.html|icons/).*)'],
};
