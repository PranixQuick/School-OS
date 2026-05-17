import { NextRequest, NextResponse } from 'next/server';

// Public paths — no auth required
const PUBLIC = [
  '/login', '/register', '/forgot-password', '/parent',
  '/parent/consent', '/student', '/api/auth/', '/api/parent/',
  '/api/student/', '/api/schools/create', '/_next/', '/favicon',
  '/icons/', '/manifest', '/api/notifications/health',
];

// Stakeholder portal paths and their required roles
const PORTAL_ROLES: Record<string, string[]> = {
  '/librarian': ['librarian', 'admin', 'owner', 'principal'],
  '/hostel-admin': ['hostel_admin', 'admin', 'owner', 'principal'],
  '/placement': ['placement_officer', 'admin', 'owner', 'principal'],
  '/hod': ['hod', 'admin', 'owner', 'principal'],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Allow API routes (auth handled in individual routes)
  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next();
    // Return 401 JSON for unauthenticated API calls (not 302 HTML redirect)
    // Individual API routes do their own auth check via requireAdminSession
    return res;
  }

  // Check session cookie
  const session = req.cookies.get('school_session')?.value;
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest).*)'],
};
