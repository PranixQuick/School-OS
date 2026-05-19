import { NextRequest, NextResponse } from 'next/server';

// Public paths — no auth required
const PUBLIC = [
  '/',           // Landing page
  '/login', '/register', '/onboarding', '/forgot-password',
  '/parent', '/parent/consent',
  '/student',
  '/api/auth/', '/api/parent/', '/api/student/', '/api/schools/create',
  '/_next/', '/favicon', '/icons/', '/manifest',
  '/api/notifications/health', '/api/health',
  '/robots.txt', '/sitemap.xml',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // Handle POST /login — browser cache replay
  if (pathname === '/login' && method === 'POST') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url, 303);
  }

  // Exact root match — always public (landing page)
  if (pathname === '/') return NextResponse.next();

  // Allow public paths
  if (PUBLIC.some(p => p !== '/' && pathname.startsWith(p))) return NextResponse.next();

  // Allow all API routes (auth handled per-route)
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // Check session cookie
  const session = req.cookies.get('school_session')?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw.js|offline.html|robots.txt|sitemap.xml).*)',
  ],
};
