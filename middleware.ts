import { NextRequest, NextResponse } from 'next/server';

// Public paths — no auth required
const PUBLIC = [
  '/',
  '/login', '/register', '/onboarding', '/forgot-password',
  '/privacy', '/terms', '/support',
  '/parent', '/parent/consent',
  '/student',
  '/api/auth/', '/api/parent/', '/api/student/', '/api/schools/create',
  '/_next/', '/favicon', '/icons/', '/manifest',
  '/api/notifications/health', '/api/health',
  '/robots.txt', '/sitemap.xml', '/brand/',
];

// SEC-CRITICAL-2 — 2026-08-17.
// Identity headers that a client must never be able to assert. Nothing in this
// codebase legitimately sets these on an inbound request; they exist only as a
// vestige of an older middleware that injected them. Any inbound copy is
// therefore an attempted forgery and is deleted before the request reaches a
// route handler.
//
// Tenancy and role now come exclusively from the signed `school_session`
// cookie (see lib/getSchoolId.ts). This strip is defence in depth: it ensures
// that if a future change reintroduces `req.headers.get('x-school-id')`, the
// value it reads is always absent rather than attacker-controlled.
const FORGEABLE_IDENTITY_HEADERS = [
  'x-school-id',
  'x-user-role',
  'x-user-email',
  'x-user-id',
  'x-super-admin',
] as const;

function withStrippedIdentityHeaders(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  let stripped = false;
  for (const name of FORGEABLE_IDENTITY_HEADERS) {
    if (headers.has(name)) {
      headers.delete(name);
      stripped = true;
    }
  }
  if (stripped) {
    // Deliberately logged: in normal operation this should never fire. A
    // sustained rate here means someone is probing for the old header-authz
    // behaviour.
    console.warn(
      `[middleware] stripped forged identity header(s) on ${req.method} ${req.nextUrl.pathname}`
    );
  }
  return NextResponse.next({ request: { headers } });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  if (pathname === '/login' && method === 'POST') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url, 303);
  }

  if (pathname === '/') return withStrippedIdentityHeaders(req);

  if (PUBLIC.some(p => p !== '/' && pathname.startsWith(p))) {
    return withStrippedIdentityHeaders(req);
  }

  // API routes authenticate themselves (session cookie -> lib/auth.getSession).
  // Middleware does not gate them, but it does strip forgeable identity
  // headers so a route can never be tricked into trusting one.
  if (pathname.startsWith('/api/')) return withStrippedIdentityHeaders(req);

  const session = req.cookies.get('school_session')?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return withStrippedIdentityHeaders(req);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw.js|offline.html|robots.txt|sitemap.xml).*)',
  ],
};
