import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't need auth
const PUBLIC_PATHS = ['/login', '/register', '/api/auth/login', '/api/auth/logout', '/api/schools/create'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static files
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
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

  // Inject school_id header for API routes to use
  try {
    const sessionData = JSON.parse(Buffer.from(session.value, 'base64').toString('utf-8'));
    const res = NextResponse.next();
    res.headers.set('x-school-id', sessionData.schoolId ?? '');
    res.headers.set('x-user-role', sessionData.userRole ?? '');
    return res;
  } catch {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
