// app/api/auth/callback/route.ts
// Phase 0 Task 0.1 — magic-link callback.
// Supabase Auth redirects the user here after they click the link.
// We verify the token_hash with Supabase, map the resolved email to a school_users row,
// link auth_user_id, and mint our signed JWT session cookie.
//
// Phase 1 Task 1.0 / 1.2 tail — populate auth.users.app_metadata on every
// successful verification so RLS helper functions resolving from the
// Supabase-issued JWT (current_school_id, current_institution_id,
// current_user_role, current_staff_id) see up-to-date values.
// app_metadata is server-only (not writable from a client SDK call).
// Payload: { school_id, institution_id, user_role, user_id, staff_id }
// where staff_id is only set for role='teacher', otherwise null.
// institution_id is sourced from school_users.institution_id (populated by
// Phase 1 Task 1.2 backfill) and is null-safe — a null value is written
// explicitly so a previous value cannot linger.

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
    .select('id, school_id, institution_id, email, name, role, is_active, auth_user_id, password_migrated_at')
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

  // Phase 1 Task 1.0 — sync auth.users.user_metadata.
  // Runs on every callback (best-effort, non-blocking) so policy context stays
  // fresh if a user's role changes. Failure is logged but does not fail login.
  const metadataSync = await syncUserMetadata(authUser.id, {
    id: schoolUser.id,
    school_id: schoolUser.school_id,
    institution_id: (schoolUser.institution_id as string | null) ?? null,
    role: schoolUser.role,
    email,
  });
  if (!metadataSync.ok) {
    console.error('[callback] user_metadata sync failed:', metadataSync.error);
  }

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
    metadata: {
      path: 'magic_link_callback',
      metadata_sync: metadataSync.ok ? 'ok' : 'failed',
      metadata_sync_error: metadataSync.ok ? undefined : metadataSync.error,
    },
  });

  return response;
}

// ─── Phase 1 Task 1.0 — app_metadata sync helper ─────────────────────────────
//
// Writes a bounded set of fields into auth.users.app_metadata (server-only,
// client-tamper-proof) so RLS policies that read auth.jwt() -> app_metadata
// can resolve tenant + role. The Phase 0 RLS helper functions
// (current_school_id, current_user_role, current_staff_id) were updated in
// production to read app_metadata first with a user_metadata fallback, so
// both existing sessions and new ones resolve correctly.
//
// For role='teacher' we also look up staff.id by email within the same school
// so policies like "teacher can read only their own classes" have a handle.
// For other roles staff_id is explicitly set to null (not omitted) to clear
// any previous stale value.

interface SchoolUserLite {
  id: string;
  school_id: string;
  institution_id: string | null;
  role: string;
  email: string;
}

async function syncUserMetadata(
  authUserId: string,
  schoolUser: SchoolUserLite
): Promise<{ ok: boolean; error?: string }> {
  try {
    let staff_id: string | null = null;
    if (schoolUser.role === 'teacher') {
      const { data: staff } = await supabaseAdmin
        .from('staff')
        .select('id')
        .eq('school_id', schoolUser.school_id)
        .eq('email', schoolUser.email)
        .eq('is_active', true)
        .maybeSingle();
      if (staff?.id) staff_id = staff.id as string;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        school_id: schoolUser.school_id,
        institution_id: schoolUser.institution_id,
        user_role: schoolUser.role,
        user_id: schoolUser.id,
        staff_id,
      },
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
