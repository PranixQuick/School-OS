// app/api/admin/invite-management/generate-link/route.ts
// Generates a one-time login link for a staff member.
// USE CASE: Staff with *.edu.in email addresses cannot receive Supabase magic-link
// emails because the built-in SMTP rejects those domains. Admin generates the link
// and shares it via WhatsApp/SMS. The link is identical to an email magic-link.
// Single-use, expires in 1 hour. Fully audited.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/logger';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Admin or owner required' }, { status: 403 });
  }

  let body: { user_id?: string; email?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.user_id || !body?.email) return NextResponse.json({ error: 'user_id and email required' }, { status: 400 });

  // Verify the user belongs to this school (prevent cross-school attack)
  const { data: schoolUser } = await supabaseAdmin.from('school_users')
    .select('id, auth_user_id, email')
    .eq('id', body.user_id)
    .eq('school_id', session.schoolId)
    .eq('is_active', true)
    .single();

  if (!schoolUser) return NextResponse.json({ error: 'Staff member not found in this school' }, { status: 404 });

  // Generate magic link via Supabase admin API
  // This generates the SAME kind of link as the email magic link
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.edprosys.com';
  const redirectTo = `${origin}/api/auth/callback`;

  try {
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: schoolUser.email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      return NextResponse.json({
        error: linkErr?.message ?? 'Failed to generate link. Check that this email exists in Supabase Auth.',
        hint: 'If the email was never confirmed in Supabase Auth, use "Resend Email" first to create the auth account, then try again.',
      }, { status: 500 });
    }

    await logActivity({
      schoolId: session.schoolId,
      action: `Admin generated activation link for ${schoolUser.email}`,
      module: 'import',
      details: { admin: session.userId, target_email: schoolUser.email },
    });

    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    return NextResponse.json({
      success: true,
      link: linkData.properties.action_link,
      expires_at: expiresAt,
      email: schoolUser.email,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
