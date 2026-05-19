import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import {
  createSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from '@/lib/session';
import {
  getSession,
  logAuthEvent,
  clientIpFromRequest,
} from '@/lib/auth';
import { env } from '@/lib/env';
import { rateLimitLogin } from '@/lib/rateLimit';

// GET /api/auth/login — explicit 405 with helpful message
// Prevents generic Next.js 405 from appearing in Vercel logs
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to login.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  const { limited, remaining } = await rateLimitLogin(ip);
  if (limited) {
    await logAuthEvent({ eventType: 'rate_limited', ip, userAgent: req.headers.get('user-agent') });
    return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
  }

  let email: string, password: string;
  try {
    const body = await req.json();
    email = (body.email ?? '').trim().toLowerCase();
    password = body.password ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('school_users')
    .select('id, email, role, school_id, password_hash, is_active, staff_id')
    .eq('email', email)
    .maybeSingle();

  if (error || !user) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, userAgent: req.headers.get('user-agent'), metadata: { reason: 'user_not_found' } });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  if (!user.is_active) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, userAgent: req.headers.get('user-agent'), metadata: { reason: 'account_inactive' } });
    return NextResponse.json({ error: 'Account is inactive' }, { status: 401 });
  }

  if (!user.password_hash) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, userAgent: req.headers.get('user-agent'), metadata: { reason: 'no_password_set' } });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, userAgent: req.headers.get('user-agent'), metadata: { reason: 'wrong_password' } });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = await createSession({
    userId: user.id,
    schoolId: user.school_id,
    userRole: user.role,
    userEmail: user.email,
    staffId: user.staff_id ?? undefined,
  });

  await logAuthEvent({
    eventType: 'login_success',
    email: user.email,
    ip,
    userAgent: req.headers.get('user-agent'),
    metadata: { role: user.role, school_id: user.school_id },
  });

  const res = NextResponse.json({ success: true, role: user.role, school_id: user.school_id });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  return res;
}
