import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Public paths — no auth required
const PUBLIC = [
  '/',
  '/login', '/register', '/onboarding', '/forgot-password',
  '/privacy', '/terms', '/support',
  '/parent', '/parent/consent',
  '/student',
  '/vendor',
  '/api/auth/', '/api/parent/', '/api/student/', '/api/vendor/', '/api/schools/create',
  '/_next/', '/favicon', '/icons/', '/manifest',
  '/api/notifications/health', '/api/health',
  '/robots.txt', '/sitemap.xml',
];

const SESSION_COOKIE = 'school_session';
const ISSUER = 'school-os';
const ALG = 'HS256';

function secretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? '');
}

// Lightweight Edge-safe JWT verification. Returns the signed claims we forward
// as request headers. NO denylist check here (that needs Node/Supabase) — route
// handlers still run full requireAdminSession()/getSession() incl. the revocation
// denylist, so this only forwards already-signed claims; it never grants access.
async function readSessionClaims(token: string | undefined): Promise<{ schoolId: string; userRole: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, algorithms: [ALG] });
    if (typeof payload.schoolId !== 'string') return null;
    return { schoolId: payload.schoolId, userRole: (payload.userRole as string) ?? '' };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  if (pathname === '/login' && method === 'POST') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url, 303);
  }

  if (pathname === '/') return NextResponse.next();

  if (PUBLIC.some(p => p !== '/' && pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await readSessionClaims(token);

  // API routes: inject x-school-id / x-user-role from the verified session so
  // getSchoolId(req)-based handlers can resolve their tenant. Handlers enforce
  // their own auth; missing claims simply means the header is absent (handler 401/500s).
  if (pathname.startsWith('/api/')) {
    if (claims) {
      const headers = new Headers(req.headers);
      headers.set('x-school-id', claims.schoolId);
      headers.set('x-user-role', claims.userRole);
      return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next();
  }

  // Page routes: require a valid session, else redirect to login.
  if (!claims) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set('x-school-id', claims.schoolId);
  headers.set('x-user-role', claims.userRole);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest|sw.js|offline.html|robots.txt|sitemap.xml).*)',
  ],
};
