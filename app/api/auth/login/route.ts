import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { issueSession, sessionCookie } from '@/lib/session';
import { getSession, logAuthEvent, clientIpFromRequest } from '@/lib/auth';
import { enforceLoginRateLimit, isE2EBypass } from '@/lib/rate-limit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

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

  let email: string, password: string;
  try {
    const body = await req.json() as { email?: string; password?: string };
    email = (body.email ?? '').trim().toLowerCase();
    password = body.password ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  // Rate limit enforcement — skip only for CI E2E bypass
  const bypassHeader = req.headers.get('x-e2e-bypass');
  if (!isE2EBypass(bypassHeader)) {
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
  }

  // Authenticate via Supabase Auth using anon key.
  // signInWithPassword requires the anon key (not service role).
  // Root cause of prior failures: auth.identities records were missing for
  // accounts created via direct SQL insert rather than proper signup flow.
  // Migration create_auth_identities_for_ci_demo_accounts fixed this.
  const authClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    await logAuthEvent({
      eventType: 'login_failure', email, ip,
      metadata: { reason: authError?.message ?? 'auth_failed' },
    });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // Look up school_users record by auth_user_id
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
    const { data: staffRow } = await supabaseAdmin
      .from('staff').select('name').eq('id', schoolUser.staff_id).single();
    if (staffRow?.name) userName = staffRow.name;
  }

  const token = await issueSession({
    userId: schoolUser.id,
    schoolId: schoolUser.school_id,
    userEmail: schoolUser.email,
    userRole: schoolUser.role,
    schoolName, schoolSlug, plan, userName,
  });

  const cookieStore = await cookies();
  const cookieOpts = sessionCookie(token, process.env.NODE_ENV === 'production');
  cookieStore.set(cookieOpts.name, cookieOpts.value, cookieOpts);

  await logAuthEvent({
    eventType: 'login_success', email, ip,
    metadata: { role: schoolUser.role, school_id: schoolUser.school_id },
  });

  return NextResponse.json({
    success: true,
    redirectTo: roleRedirect(schoolUser.role),
    role: schoolUser.role,
  });
}

function roleRedirect(role: string): string {
  switch (role) {
    case 'owner':      return '/owner';
    case 'teacher':    return '/teacher';
    case 'principal':  return '/principal';
    case 'student':    return '/student';
    default:           return '/dashboard';
  }
}
