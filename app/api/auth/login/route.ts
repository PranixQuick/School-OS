// app/api/auth/login/route.ts
// POST-only endpoint. GET added to return a clear 405 instead of Next.js generic 405.
// Eliminates noise from bots and misconfigured clients hitting GET /api/auth/login.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { signSession } from '@/lib/session';
import { getSession, logAuthEvent, clientIpFromRequest } from '@/lib/auth';
import { env } from '@/lib/env';

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST to login.', hint: 'POST /api/auth/login with { email, password }' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  
  // Check if already logged in
  const existing = await getSession(req);
  if (existing) {
    const redirectTo = existing.userRole === 'teacher' ? '/teacher' :
      existing.userRole === 'principal' ? '/principal' :
      existing.userRole === 'accountant' ? '/dashboard' :
      '/dashboard';
    return NextResponse.json({ redirectTo });
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

  // Rate limit check
  const { data: rateCheck } = await supabaseAdmin
    .from('api_rate_log')
    .select('id')
    .eq('identifier', ip)
    .eq('endpoint', 'login')
    .gte('created_at', new Date(Date.now() - 60000).toISOString())
    .limit(10);

  if ((rateCheck?.length ?? 0) >= 10) {
    await logAuthEvent({ eventType: 'rate_limited', email, ip, metadata: { reason: 'login_attempts' } });
    return NextResponse.json({ error: 'Too many login attempts. Please wait 1 minute.' }, { status: 429 });
  }

  // Log this attempt
  await supabaseAdmin.from('api_rate_log').insert({ identifier: ip, endpoint: 'login' }).then(() => {}, () => {});

  // Look up user
  const { data: users, error: lookupErr } = await supabaseAdmin
    .from('school_users')
    .select('id, school_id, email, password_hash, role, is_active, staff_id')
    .eq('email', email)
    .limit(2);

  if (lookupErr || !users || users.length === 0) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, metadata: { reason: 'user_not_found' } });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const user = users[0];
  if (!user.is_active) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, metadata: { reason: 'account_inactive' } });
    return NextResponse.json({ error: 'Account is inactive. Contact your school administrator.' }, { status: 401 });
  }

  // Verify password
  if (!user.password_hash) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, metadata: { reason: 'no_password_set' } });
    return NextResponse.json({ error: 'Password not set.', code: 'USE_MAGIC_LINK' }, { status: 401 });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, metadata: { reason: 'wrong_password' } });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // Issue session
  const token = await signSession({
    userId: user.id,
    schoolId: user.school_id,
    userEmail: user.email,
    userRole: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME ?? 'school_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  await logAuthEvent({
    eventType: 'login_success',
    email,
    ip,
    metadata: { role: user.role, school_id: user.school_id },
  });
  await supabaseAdmin.from('auth_events').insert({
    event_type: 'magic_link_sent',
    email,
    ip,
    metadata: { note: 'password_login_success' },
    school_id: user.school_id,
  }).then(() => {}, () => {});

  const redirectTo = user.role === 'teacher' ? '/teacher' :
    user.role === 'principal' ? '/principal' :
    '/dashboard';

  return NextResponse.json({ success: true, redirectTo, role: user.role });
}
