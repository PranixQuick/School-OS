// app/api/auth/forgot-password/route.ts
// Real workflow: staff member clicks "Forgot password" → magic link sent to email
// Parent workflow: handled separately via PIN resend (not email-based)
// No token table complexity — we use Supabase OTP, just log the request for audit
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { createServerClient } from '@/lib/auth';
import { enforceLoginRateLimit } from '@/lib/rate-limit';
import { clientIpFromRequest } from '@/lib/auth';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  let body: { email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const email = (body.email ?? '').toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Rate limit: 3 per email per 15 minutes
  const rl = await enforceLoginRateLimit({ email, ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  // Verify the user exists in school_users — do not reveal if they don't
  const { data: user } = await supabaseAdmin
    .from('school_users').select('id, school_id, is_active').eq('email', email).maybeSingle();

  // Always return success to prevent email enumeration
  if (!user || !user.is_active) {
    return NextResponse.json({
      success: true,
      message: 'If this email is registered, you will receive a sign-in link shortly.',
    });
  }

  // Send magic link via Supabase Auth
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const client = createServerClient();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin.replace(/\/$/, '')}/api/auth/callback`,
        shouldCreateUser: false, // user must already exist
      },
    });
    if (error) console.error('[forgot-password] OTP send failed:', error.message);
  } catch (e) {
    console.error('[forgot-password] unexpected error:', e);
  }

  // Log the request for audit
  void (async () => {
    try {
      await supabaseAdmin.from('password_reset_tokens').insert({
        school_id: user.school_id,
        email,
        user_id: user.id,
        ip,
        token_hint: 'magic_link',
      });
    } catch { /* non-blocking */ }
  })();

  return NextResponse.json({
    success: true,
    message: 'If this email is registered, you will receive a sign-in link shortly.',
  });
}
