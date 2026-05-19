import { NextRequest, NextResponse } from 'next/server';

// Public paths — no auth required
const PUBLIC = [
  '/login', '/register', '/onboarding', '/forgot-password', '/parent',
  '/parent/consent', '/student', '/api/auth/', '/api/parent/',
  '/api/student/', '/api/schools/create', '/_next/', '/favicon',
  '/icons/', '/manifest', '/api/notifications/health',
  '/api/health',
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
  const method = req.method;

  // Handle POST /login — browser cache replay or misconfigured form.
  // Next.js App Router doesn't handle POST on page routes.
  // Redirect to GET /login cleanly.
  if (pathname === '/login' && method === 'POST') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url, 303);
  }

  // Allow public paths
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Allow API routes (auth handled in individual routes)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
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

  // Check portal-specific role requirements
  for (const [path] of Object.entries(PORTAL_ROLES)) {
    if (pathname.startsWith(path)) {
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  // Exclude: Next.js internals, static assets, sw.js, offline.html
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw.js|offline.html|robots.txt).*)',
  ],
};
