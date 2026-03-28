import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Fully public — no auth required
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/pricing',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/schools/create',
  '/parent',
  '/api/parent',
];

// Super admin only paths
const SUPER_ADMIN_PATHS = ['/admin'];
const SUPER_ADMIN_EMAIL = 'pranixailabs@gmail.com';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static files
  if (
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = req.cookies.get('school_session');

  if (!session?.value) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const sessionData = JSON.parse(Buffer.from(session.value, 'base64').toString('utf-8'));

    // Super admin path protection
    if (SUPER_ADMIN_PATHS.some(p => pathname.startsWith(p))) {
      if (sessionData.userEmail !== SUPER_ADMIN_EMAIL) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    // Inject headers for API routes
    const res = NextResponse.next();
    res.headers.set('x-school-id', sessionData.schoolId ?? '');
    res.headers.set('x-user-role', sessionData.userRole ?? '');
    res.headers.set('x-user-email', sessionData.userEmail ?? '');
    return res;
  } catch {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
