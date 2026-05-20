import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { issueSession, sessionCookie } from '@/lib/session';
import { getSession, logAuthEvent, clientIpFromRequest } from '@/lib/auth';
import { enforceLoginRateLimit, isE2EBypass } from '@/lib/rate-limit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

// ─── Email sanitization ──────────────────────────────────────────────────────
// Handles Samsung keyboard spaces, mobile autofill, Telugu IME injection.
// Also catches copy-paste from WhatsApp messages that add zero-width spaces.
function sanitizeEmail(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip zero-width chars (WhatsApp)
    .replace(/\s+/g, '')                    // strip ALL whitespace including mid-string
    .toLowerCase()
    .trim();
}

// ─── Validate email format (basic) ──────────────────────────────────────────
function isValidEmail(email: string): boolean {
  // Must have exactly one @, local part, domain with at least one dot
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST to login.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);

  // Already logged in?
  const existing = await getSession(req);
  if (existing) {
    return NextResponse.json({ redirectTo: roleRedirect(existing.userRole) });
  }

  let rawEmail: string, password: string;
  try {
    const body = await req.json() as { email?: string; password?: string };
    rawEmail  = body.email    ?? '';
    password  = body.password ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── Server-side sanitization (defence-in-depth beyond client-side) ────────
  const email = sanitizeEmail(rawEmail);

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  // Validate email format BEFORE calling Supabase Auth (saves a round-trip + better error)
  if (!isValidEmail(email)) {
    return NextResponse.json({
      error: 'Invalid email format. Make sure there are no spaces in the email address.',
      code: 'INVALID_EMAIL_FORMAT',
    }, { status: 400 });
  }

  const bypassHeader = req.headers.get('x-e2e-bypass');
  const isCI = isE2EBypass(bypassHeader);

  // ── E2E CI FAST PATH ──────────────────────────────────────────────────────
  if (isCI) {
    const { data: schoolUser, error: userErr } = await supabaseAdmin
      .from('school_users')
      .select('id, school_id, email, role, is_active, staff_id, schools(name, slug, plan)')
      .eq('email', email)
      .maybeSingle();

    if (userErr || !schoolUser) {
      return NextResponse.json({ error: 'CI account not found in school_users.' }, { status: 401 });
    }
    if (!schoolUser.is_active) {
      return NextResponse.json({ error: 'Account is inactive.' }, { status: 401 });
    }

    const schoolRow = Array.isArray(schoolUser.schools) ? schoolUser.schools[0] : schoolUser.schools;
    const schoolName = (schoolRow as { name?: string } | null)?.name ?? '';
    const schoolSlug = (schoolRow as { slug?: string } | null)?.slug ?? '';
    const plan = (schoolRow as { plan?: string } | null)?.plan ?? 'starter';

    const token = await issueSession({
      userId: schoolUser.id, schoolId: schoolUser.school_id,
      userEmail: schoolUser.email, userRole: schoolUser.role,
      schoolName, schoolSlug, plan, userName: email.split('@')[0],
    });

    const cookieStore = await cookies();
    const cookieOpts = sessionCookie(token, process.env.NODE_ENV === 'production');
    cookieStore.set(cookieOpts.name, cookieOpts.value, cookieOpts);

    return NextResponse.json({ success: true, redirectTo: roleRedirect(schoolUser.role), role: schoolUser.role });
  }
  // ── END CI FAST PATH ──────────────────────────────────────────────────────

  // Check if school_users row exists + has auth_user_id set
  // If no auth_user_id: invitation was never sent / accepted → give actionable error
  const { data: userCheck } = await supabaseAdmin
    .from('school_users')
    .select('id, auth_user_id, invite_status, is_active')
    .eq('email', email)
    .maybeSingle();

  if (userCheck && !userCheck.auth_user_id) {
    // User exists in school_users but hasn't set up Supabase Auth account yet
    const inviteStatus = (userCheck as { invite_status?: string }).invite_status ?? 'pending';
    return NextResponse.json({
      error: inviteStatus === 'pending'
        ? 'Your account has not been set up yet. Please ask your school admin to send you a login invitation.'
        : 'Your login setup is incomplete. Please check your email for an invitation from EdProSys and click "Set Password".',
      code: 'AUTH_NOT_PROVISIONED',
      invite_status: inviteStatus,
    }, { status: 401 });
  }

  // Production path: rate limiter then Supabase Auth
  const rl = await enforceLoginRateLimit({ email, ip });
  if (!rl.allowed) {
    await logAuthEvent({
      eventType: 'rate_limited', email, ip,
      metadata: { retryAfterSec: rl.retryAfterSec, source: rl.source },
    });
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const authClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });

  if (authError || !authData.user) {
    await logAuthEvent({
      eventType: 'login_failure', email, ip,
      metadata: { reason: authError?.message ?? 'auth_failed' },
    });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const { data: schoolUser, error: userErr } = await supabaseAdmin
    .from('school_users')
    .select('id, school_id, email, role, is_active, staff_id, schools(name, slug, plan)')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (userErr || !schoolUser) {
    await logAuthEvent({
      eventType: 'login_failure', email, ip,
      metadata: { reason: 'no_school_user', auth_uid: authData.user.id },
    });
    return NextResponse.json({ error: 'No school account linked to this login.' }, { status: 403 });
  }

  if (!schoolUser.is_active) {
    await logAuthEvent({
      eventType: 'login_failure', email, ip,
      metadata: { reason: 'account_inactive' },
    });
    return NextResponse.json({ error: 'Account is inactive. Contact your school administrator.' }, { status: 401 });
  }

  const schoolRow = Array.isArray(schoolUser.schools) ? schoolUser.schools[0] : schoolUser.schools;
  const schoolName = (schoolRow as { name?: string } | null)?.name ?? '';
  const schoolSlug = (schoolRow as { slug?: string } | null)?.slug ?? '';
  const plan = (schoolRow as { plan?: string } | null)?.plan ?? 'starter';

  let userName = email.split('@')[0];
  if (schoolUser.staff_id) {
    const { data: staffRow } = await supabaseAdmin.from('staff').select('name').eq('id', schoolUser.staff_id).single();
    if (staffRow?.name) userName = staffRow.name;
  }

  const token = await issueSession({
    userId: schoolUser.id, schoolId: schoolUser.school_id,
    userEmail: schoolUser.email, userRole: schoolUser.role,
    schoolName, schoolSlug, plan, userName,
  });

  const cookieStore = await cookies();
  const cookieOpts = sessionCookie(token, process.env.NODE_ENV === 'production');
  cookieStore.set(cookieOpts.name, cookieOpts.value, cookieOpts);

  // Mark first login + auth_verified on school_users
  await supabaseAdmin.from('school_users')
    .update({
      last_login: new Date().toISOString(),
      first_login_at: schoolUser.last_login ? undefined : new Date().toISOString(),
      auth_verified: true,
      invite_status: 'verified',
    })
    .eq('id', schoolUser.id);

  await logAuthEvent({
    eventType: 'login_success', email, ip,
    metadata: { role: schoolUser.role, school_id: schoolUser.school_id },
  });

  return NextResponse.json({ success: true, redirectTo: roleRedirect(schoolUser.role), role: schoolUser.role });
}

function roleRedirect(role: string): string {
  switch (role) {
    case 'owner':     return '/owner';
    case 'teacher':   return '/teacher';
    case 'principal': return '/principal';
    case 'student':   return '/student';
    default:          return '/dashboard';
  }
}
