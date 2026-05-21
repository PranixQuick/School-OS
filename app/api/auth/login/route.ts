import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { issueSession, sessionCookie } from '@/lib/session';
import { getSession, logAuthEvent, clientIpFromRequest } from '@/lib/auth';
import { enforceLoginRateLimit, isE2EBypass } from '@/lib/rate-limit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

function sanitizeEmail(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').toLowerCase().trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST to login.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);

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

  const email = sanitizeEmail(rawEmail);

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({
      error: 'Invalid email format. Make sure there are no spaces in the email address.',
      code: 'INVALID_EMAIL_FORMAT',
    }, { status: 400 });
  }

  const bypassHeader = req.headers.get('x-e2e-bypass');
  const isCI = isE2EBypass(bypassHeader);

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

  // Check if school_users row exists and has auth provisioned
  const { data: userCheck } = await supabaseAdmin
    .from('school_users')
    .select('id, auth_user_id, is_active')
    .eq('email', email)
    .maybeSingle();

  if (userCheck && !userCheck.auth_user_id) {
    return NextResponse.json({
      error: 'Your login is not yet active. Please check your email for an EdProSys setup invitation and click "Set Password". If you have not received it, ask your school admin.',
      code: 'AUTH_NOT_PROVISIONED',
    }, { status: 401 });
  }

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
    .select('id, school_id, email, role, is_active, staff_id, last_login, schools(name, slug, plan)')
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

  const isFirstLogin = !schoolUser.last_login;
  await supabaseAdmin.from('school_users').update({
    last_login:     new Date().toISOString(),
    ...(isFirstLogin ? { first_login_at: new Date().toISOString() } : {}),
    auth_verified:  true,
    invite_status:  'verified',
  }).eq('id', schoolUser.id);

  await logAuthEvent({
    eventType: 'login_success', email, ip,
    metadata: { role: schoolUser.role, school_id: schoolUser.school_id, first_login: isFirstLogin },
  });

  return NextResponse.json({ success: true, redirectTo: roleRedirect(schoolUser.role), role: schoolUser.role });
}

// roleRedirect — maps role to correct dashboard route
// All roles must be mapped; unknown roles default to /dashboard
function roleRedirect(role: string): string {
  switch (role) {
    case 'owner':        return '/owner';
    case 'teacher':
    case 'aww':          return '/teacher';
    case 'principal':
    case 'supervisor':   return '/principal';
    case 'student':      return '/student';
    case 'meo':          return '/meo/dashboard';
    case 'deo':          return '/deo/dashboard';
    case 'hod':          return '/hod/dashboard';
    case 'registrar':
    case 'dean':         return '/registrar/dashboard';
    case 'accountant':   return '/dashboard';
    case 'counsellor':   return '/dashboard';
    case 'librarian':    return '/dashboard';
    case 'transport_staff': return '/dashboard';
    case 'hostel_warden':
    case 'hostel_admin': return '/dashboard';
    case 'placement_officer': return '/admin/placement';
    default:             return '/dashboard';
  }
}
