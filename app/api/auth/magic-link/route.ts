// app/api/auth/magic-link/route.ts
// Phase 0 Task 0.1 — explicit endpoint for requesting a magic link without a password.
// Also consumes the login rate limiter so this cannot be used to bypass it.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  clientIpFromRequest,
  createServerClient,
  logAuthEvent,
} from '@/lib/auth';
import { enforceLoginRateLimit } from '@/lib/rate-limit';
import { isIpBlocked } from '@/lib/abuse/blocklist';
import { env } from '@/lib/env';

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  const userAgent = req.headers.get('user-agent');

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = (body.email ?? '').toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const block = await isIpBlocked(ip);
  if (block.blocked) {
    await logAuthEvent({
      eventType: 'rate_limited',
      email,
      ip,
      userAgent,
      metadata: { reason: 'ip_blocked', route: 'magic-link', until: block.until },
    });
    return NextResponse.json(
      { error: 'Access from this network has been temporarily restricted.' },
      { status: 403 }
    );
  }

  const rl = await enforceLoginRateLimit({ email, ip });
  if (!rl.allowed) {
    await logAuthEvent({
      eventType: 'rate_limited',
      email,
      ip,
      userAgent,
      metadata: { reason: 'magic_link_rate_limit' },
    });
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  // We always respond 200 to avoid leaking whether an account exists.
  const { data: schoolUser } = await supabaseAdmin
    .from('school_users')
    .select('id, school_id, email, is_active')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (schoolUser) {
    const origin = env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const redirectTo = `${origin.replace(/\/$/, '')}/api/auth/callback`;
    try {
      const client = createServerClient();
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) console.error('[magic-link] dispatch failed:', error.message);
    } catch (err) {
      console.error('[magic-link] unexpected:', err);
    }
  }

  return NextResponse.json({
    success: true,
    message: 'If an account exists for that email, a sign-in link has been sent.',
  });
}
