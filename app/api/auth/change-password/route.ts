// app/api/auth/change-password/route.ts
// ISS-1 (#1 / P4.6) — Self-service password change for signed-in staff.
//
// POST { current_password, new_password }
//   1. Requires a valid session (school_users role).
//   2. Re-verifies the current password via Supabase signInWithPassword
//      (rate-limited to deter brute force).
//   3. Updates the password via the service-role admin API.
//
// Staff/admin auth is Supabase-Auth backed (see app/api/auth/login). Parents,
// students and vendors use bcrypt PINs in their own tables and are NOT handled
// here — PIN self-service is a separate flow.
//
// Read/verify + a single auth update. No schema change.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession, createServerClient, logAuthEvent, clientIpFromRequest } from '@/lib/auth';
import { enforceLoginRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { current_password?: string; new_password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const current = body.current_password ?? '';
  const next = body.new_password ?? '';

  if (!current || !next) {
    return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
  }
  if (next.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: 'New password must be different from the current password' }, { status: 400 });
  }

  const email = session.userEmail;
  const ip = clientIpFromRequest(req);

  // Rate-limit the current-password verification (anti brute-force).
  const rl = await enforceLoginRateLimit({ email, ip });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  // Resolve the Supabase auth user id for this account.
  const { data: su } = await supabaseAdmin
    .from('school_users')
    .select('auth_user_id, is_active')
    .eq('id', session.userId)
    .maybeSingle();

  if (!su || !su.auth_user_id) {
    return NextResponse.json({ error: 'Password login is not enabled for this account.' }, { status: 400 });
  }
  if (su.is_active === false) {
    return NextResponse.json({ error: 'Account is inactive.' }, { status: 403 });
  }

  // Verify the current password.
  const authClient = createServerClient();
  const { data: signIn, error: signErr } = await authClient.auth.signInWithPassword({ email, password: current });
  if (signErr || !signIn?.user) {
    await logAuthEvent({
      eventType: 'login_failure', email, ip,
      schoolId: session.schoolId, userId: session.userId,
      metadata: { reason: 'change_password_current_mismatch' },
    });
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  // Update the password (service-role admin API).
  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(su.auth_user_id, { password: next });
  if (updErr) {
    console.error('[change-password] update failed:', updErr.message);
    return NextResponse.json({ error: 'Could not update password. Please try again.' }, { status: 500 });
  }

  await logAuthEvent({
    eventType: 'password_changed', email, ip,
    schoolId: session.schoolId, userId: session.userId,
  });

  return NextResponse.json({ success: true, message: 'Password updated.' });
}
