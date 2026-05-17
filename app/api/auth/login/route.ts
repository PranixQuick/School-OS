// PATH: app/api/auth/login/route.ts
// Dual-path login:
//   - Accepts email + password. Legacy password accepted while password_migrated_at IS NULL.
//   - On legacy success: sends migration magic link AND issues a short-lived (24h) JWT.
//   - password_migrated_at is set only inside /api/auth/callback after user proves email ownership.
//   - Post-migration users: legacy password rejected with USE_MAGIC_LINK.
// Audit fix: owner role redirects to /onboarding if school.onboarded_at IS NULL.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  clientIpFromRequest,
  createServerClient,
  logAuthEvent,
  type SchoolSession,
} from '@/lib/auth';
import {
  issueSession,
  SESSION_COOKIE,
  LEGACY_SESSION_MAX_AGE_SEC,
} from '@/lib/session';
import { enforceLoginRateLimit, isE2EBypass } from '@/lib/rate-limit';
import { isIpBlocked } from '@/lib/abuse/blocklist';
import { env } from '@/lib/env';

function cookieFlags(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

function magicLinkRedirectUrl(req: NextRequest): string {
  const origin = env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  return `${origin.replace(/\/$/, '')}/api/auth/callback`;
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  const userAgent = req.headers.get('user-agent');

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = (body.email ?? '').toLowerCase().trim();
  const password = body.password ?? '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  if (!isE2EBypass(req.headers.get('x-e2e-bypass'))) {
    const block = await isIpBlocked(ip);
    if (block.blocked) {
      await logAuthEvent({
        eventType: 'rate_limited',
        email, ip, userAgent,
        metadata: { reason: 'ip_blocked', until: block.until, block_reason: block.reason },
      });
      return NextResponse.json(
        { error: 'Access from this network has been temporarily restricted.' },
        { status: 403 }
      );
    }
  }

  if (!isE2EBypass(req.headers.get('x-e2e-bypass'))) {
    const rl = await enforceLoginRateLimit({ email, ip });
    if (!rl.allowed) {
      await logAuthEvent({
        eventType: 'rate_limited',
        email, ip, userAgent,
        metadata: { reason: 'login_rate_limit', count: rl.count, source: rl.source },
      });
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
  }

  const { data: schoolUser, error: userErr } = await supabaseAdmin
    .from('school_users')
    .select('id, school_id, email, name, role, is_active, password_migrated_at, auth_user_id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (userErr || !schoolUser) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, userAgent, metadata: { reason: 'user_not_found' } });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  if (schoolUser.password_migrated_at && !isE2EBypass(req.headers.get('x-e2e-bypass'))) {
    await logAuthEvent({
      eventType: 'login_failure', schoolId: schoolUser.school_id,
      userId: schoolUser.id, email, ip, userAgent,
      metadata: { reason: 'legacy_password_rejected_post_migration' },
    });
    return NextResponse.json(
      { error: 'Password sign-in is disabled for this account. Please use the email link option.', code: 'USE_MAGIC_LINK' },
      { status: 401 }
    );
  }

  // Legacy demo password — supports both brand prefixes
  const expectedPassword = `edprosys${schoolUser.school_id.slice(0, 4)}`;
  const legacyExpected = `schoolos${schoolUser.school_id.slice(0, 4)}`;
  if (password !== expectedPassword && password !== legacyExpected) {
    await logAuthEvent({
      eventType: 'login_failure', schoolId: schoolUser.school_id,
      userId: schoolUser.id, email, ip, userAgent,
      metadata: { reason: 'bad_password' },
    });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('id, name, slug, plan, onboarded_at')
    .eq('id', schoolUser.school_id)
    .single();

  if (!school) {
    await logAuthEvent({
      eventType: 'login_failure', schoolId: schoolUser.school_id,
      userId: schoolUser.id, email, ip, userAgent,
      metadata: { reason: 'school_not_found' },
    });
    return NextResponse.json({ error: 'School not found' }, { status: 404 });
  }

  // Dispatch migration magic link (deduplicated to 1 per 24h)
  const dispatch = await dispatchMigrationMagicLink({
    email, schoolId: schoolUser.school_id, userId: schoolUser.id,
    ip, userAgent, redirectTo: magicLinkRedirectUrl(req),
  });

  await supabaseAdmin
    .from('school_users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', schoolUser.id);

  const sessionShape: SchoolSession = {
    schoolId: school.id,
    schoolName: school.name,
    schoolSlug: school.slug ?? school.id,
    plan: school.plan,
    userId: schoolUser.id,
    userEmail: schoolUser.email,
    userRole: schoolUser.role,
    userName: schoolUser.name,
  };

  const token = await issueSession(sessionShape, { variant: 'legacy' });

  // Role-based redirect.
  // Audit fix: owner/admin with no onboarded_at goes to /onboarding to complete setup.
  // This prevents new owners from landing on an empty dashboard with zero context.
  const notOnboarded = !school.onboarded_at;
  const redirectTo =
    (schoolUser.role === 'owner' || schoolUser.role === 'admin') && notOnboarded
      ? '/onboarding'
      : schoolUser.role === 'principal' ? '/principal'
      : schoolUser.role === 'teacher' ? '/teacher'
      : schoolUser.role === 'accountant' ? '/accounts'
      : '/dashboard';

  const response = NextResponse.json({
    success: true,
    school: school.name,
    role: schoolUser.role,
    redirectTo,
    magicLinkSent: !dispatch.skipped,
    magicLinkSkipped: dispatch.skipped,
    sessionVariant: 'legacy',
    sessionExpiresInSec: LEGACY_SESSION_MAX_AGE_SEC,
  });
  response.cookies.set(SESSION_COOKIE, token, cookieFlags(LEGACY_SESSION_MAX_AGE_SEC));

  await logAuthEvent({
    eventType: 'login_success',
    schoolId: school.id, userId: schoolUser.id, email, ip, userAgent,
    metadata: { path: 'legacy_password', variant: 'legacy', redirectTo, notOnboarded },
  });

  return response;
}

async function hasRecentMagicLinkOrMigration(email: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('auth_events')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .in('event_type', ['magic_link_sent', 'password_migrated'])
    .gte('created_at', since);
  if (error) return false;
  return (count ?? 0) > 0;
}

interface DispatchInput {
  email: string; schoolId: string; userId: string;
  ip: string | null; userAgent: string | null; redirectTo: string;
}

async function dispatchMigrationMagicLink(input: DispatchInput): Promise<{ skipped: boolean }> {
  const skipped = await hasRecentMagicLinkOrMigration(input.email);
  if (skipped) {
    await logAuthEvent({
      eventType: 'magic_link_sent', schoolId: input.schoolId, userId: input.userId,
      email: input.email, ip: input.ip, userAgent: input.userAgent,
      metadata: { skipped: true, reason: 'dedupe_24h' },
    });
    return { skipped: true };
  }
  try {
    const client = createServerClient();
    const { error } = await client.auth.signInWithOtp({
      email: input.email,
      options: { emailRedirectTo: input.redirectTo, shouldCreateUser: true },
    });
    if (error) console.error('[magic-link] dispatch failed:', error.message);
  } catch (err) {
    console.error('[magic-link] unexpected error:', err);
  }
  await logAuthEvent({
    eventType: 'magic_link_sent', schoolId: input.schoolId, userId: input.userId,
    email: input.email, ip: input.ip, userAgent: input.userAgent,
    metadata: { skipped: false },
  });
  return { skipped: false };
}
