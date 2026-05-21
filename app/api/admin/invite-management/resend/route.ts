// app/api/admin/invite-management/resend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { createServerClient } from '@/lib/auth';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Admin or owner required' }, { status: 403 });
  }

  let body: { user_id?: string; email?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Verify staff belongs to this school
  const { data: schoolUser } = await supabaseAdmin.from('school_users')
    .select('id, email').eq('email', body.email).eq('school_id', session.schoolId).eq('is_active', true).single();
  if (!schoolUser) return NextResponse.json({ error: 'Staff not found in this school' }, { status: 404 });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.edprosys.com';
  const redirectTo = `${origin}/api/auth/callback`;

  // Use server client to send magic link
  const client = createServerClient();
  const { error } = await client.auth.signInWithOtp({
    email: body.email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });

  if (error) {
    return NextResponse.json({
      error: error.message,
      hint: error.message.includes('invalid') ? 'This email domain may not be supported by Supabase SMTP. Use "Generate Activation Link" instead.' : undefined,
    }, { status: 400 });
  }

  await supabaseAdmin.from('school_users').update({ invite_sent_at: new Date().toISOString() }).eq('id', schoolUser.id);
  return NextResponse.json({ success: true });
}
