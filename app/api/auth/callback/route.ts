// app/api/auth/callback/route.ts
// Phase 0 Task 0.1 — magic-link callback.
// Supabase Auth redirects the user here after they click the link.
// We verify the token_hash with Supabase, map the resolved email to a school_users row,
// link auth_user_id, and mint our signed JWT session cookie.

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
  SESSION_MAX_AGE_SEC,
} from '@/lib/session';
import { env } from '@/lib/env';

function secureCookieFlags() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SEC,
    path: '/',
  };
}

function redirectWithError(req: NextRequest, msg: string) {
  const url = new URL('/login', req.url);
  url.searchParams.set('error', msg);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  const userAgent = req.headers.get('user-agent');

  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = (req.nextUrl.searchParams.get('type') ?? 'email') as
    | 'email'
    | 'magiclink'
    | 'recovery'
    | 'invite'
    | 'email_change';
  const next = req.nextUrl.searchParams.get('next') ?? '/dashboard';

  if (!tokenHash) {
    return redirectWithError(req, 'missing_token');
  }

  const client = createServerClient();
  const { data, error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: type === 'magiclink' ? 'email' : type,
  });

  if (error || !data.user?.email) {
    await logAuthEvent({
      eventType: 'login_failure',
      ip,
      userAgent,
      metadata: { reason: 'magic_link_invalid', err: error?.message ?? 'no_user' },
    });
    return redirectWithError(req, 'invalid_or_expired_link');
  }

  const authUser = data.user;
  const email = authUser.email!.toLowerCase().trim();

  const { data: schoolUser } = await supabaseAdmin
    .from('school_users')
    .select('id, school_id, email, name, role, is_active, auth_user_id, password_migrated_at')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (!schoolUser) {
    await logAuthEvent({
      eventType: 'login_failure',
      email,
      ip,
      userAgent,
      metadata: { reason: 'no_school_user_for_email' },
    });
    return redirectWithError(req, 'no_account_for_email');
  }

  // Link auth.users -> school_users and finalise migration the first time.
  const updates: Record<string, unknown> = { last_login: new Date().toISOString() };
  if (schoolUser.auth_user_id !== authUser.id) updates.auth_user_id = authUser.id;
  if (!schoolUser.password_migrated_at) updates.password_migrated_at = new Date().toISOString();
  await supabaseAdmin.from('school_users').update(updates).eq('id', schoolUser.id);

  if (!schoolUser.password_migrated_at) {
    await logAuthEvent({
      eventType: 'password_migrated',
      schoolId: schoolUser.school_id,
      userId: schoolUser.id,
      email,
      ip,
      userAgent,
      metadata: { path: 'magic_link_callback' },
    });
  }

  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('id, name, slug, plan')
    .eq('id', schoolUser.school_id)
    .single();

  if (!school) {
    return redirectWithError(req, 'school_not_found');
  }

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

  const token = await issueSession(sessionShape);

  const nextPath = next.startsWith('/') ? next : '/dashboard';
  const response = NextResponse.redirect(new URL(nextPath, req.url));
  response.cookies.set(SESSION_COOKIE, token, secureCookieFlags());

  await logAuthEvent({
    eventType: 'login_success',
    schoolId: school.id,
    userId: schoolUser.id,
    email,
    ip,
    userAgent,
    metadata: { path: 'magic_link_callback' },
  });

  return response;
}
