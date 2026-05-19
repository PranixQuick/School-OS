import { NextResponse } from 'next/server';

// POST /login handler — runs alongside page.tsx which handles GET.
// Handles browser cache replay POSTs that cause "Failed to find Server Action" 404.
// Redirects to GET /login with 303 See Other.
export function POST() {
  return NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.edprosys.com'),
    { status: 303 }
  );
}
