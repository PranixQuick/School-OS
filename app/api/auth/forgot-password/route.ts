// app/api/auth/forgot-password/route.ts
// Real workflow: teacher or admin clicks "Forgot password?" on login page
// System sends a magic link to their registered email.
// This IS the password reset — EdProSys uses passwordless email links, not password fields.
// No new token table needed — Supabase OTP is the reset mechanism.
// Rate-limited: 1 request per email per 10 minutes.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { createServerClient, logAuthEvent } from '@/lib/auth';
import { clientIpFromRequest } from '@/lib/auth';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  let body: { email?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const email = (body.email ?? '').toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Verify the email belongs to an active school_users account
  const { data: user } = await supabaseAdmin
    .from('school_users')
    .select('id, school_id, name, is_active')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  // Always return success to prevent email enumeration — do not reveal if email exists
  if (!user) {
    return NextResponse.json({
      success: true,
      message: 'If this email is registered, a sign-in link has been sent.',
    });
  }

  // Rate limit: check for recent magic link in last 10 minutes
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('auth_events')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .eq('event_type', 'magic_link_sent')
    .gte('created_at', since);

  if ((count ?? 0) > 0) {
    return NextResponse.json({
      success: true,
      message: 'A sign-in link was recently sent. Please check your email or wait a few minutes.',
    });
  }

  // Send magic link via Supabase Auth
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const redirectTo = `${origin.replace(/\/$/, '')}/api/auth/callback`;
    const client = createServerClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    if (error) {
      console.error('[forgot-password] OTP error:', error.message);
    }
  } catch (e) {
    console.error('[forgot-password] unexpected:', e);
  }

  await logAuthEvent({
    eventType: 'magic_link_sent',
    schoolId: user.school_id,
    userId: user.id,
    email,
    ip,
    metadata: { source: 'forgot_password' },
  });

  return NextResponse.json({
    success: true,
    message: 'If this email is registered, a sign-in link has been sent.',
  });
}
