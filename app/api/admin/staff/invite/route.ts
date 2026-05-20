// app/api/admin/staff/invite/route.ts
// Staff account provisioning via Supabase Auth invitation.
// POST /api/admin/staff/invite          → invite one staff member
// POST /api/admin/staff/invite?bulk=1   → invite all uninvited staff in school

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

function sanitizeEmail(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').toLowerCase().trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only admin/owner/principal can invite staff
  if (!['admin', 'owner', 'principal'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const bulk = req.nextUrl.searchParams.get('bulk') === '1';
  const schoolId = session.schoolId;

  if (bulk) {
    // Send invitations to ALL uninvited staff in this school
    const { data: uninvited } = await supabaseAdmin
      .from('school_users')
      .select('id, email, name, invite_status')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .in('invite_status', ['pending', 'failed'])
      .is('auth_user_id', null);

    if (!uninvited || uninvited.length === 0) {
      return NextResponse.json({ message: 'All staff already invited or provisioned.', invited: 0 });
    }

    const results: { email: string; status: string; error?: string }[] = [];

    for (const user of uninvited) {
      const email = sanitizeEmail(user.email);
      if (!isValidEmail(email)) {
        results.push({ email, status: 'failed', error: 'Invalid email format' });
        await supabaseAdmin.from('school_users')
          .update({ invite_status: 'failed' }).eq('id', user.id);
        continue;
      }

      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { school_id: schoolId, school_user_id: user.id, name: user.name },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.edprosys.com'}/login`,
      });

      if (inviteErr) {
        results.push({ email, status: 'failed', error: inviteErr.message });
        await supabaseAdmin.from('school_users')
          .update({ invite_status: 'failed' }).eq('id', user.id);
      } else {
        results.push({ email, status: 'invited' });
        await supabaseAdmin.from('school_users').update({
          invite_status: 'invited',
          invite_sent_at: new Date().toISOString(),
          auth_user_id: inviteData.user?.id ?? null,
        }).eq('id', user.id);
      }
    }

    const invited = results.filter(r => r.status === 'invited').length;
    const failed  = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({ message: `Invitations sent: ${invited} ok, ${failed} failed`, invited, failed, results });
  }

  // Single staff invite
  let body: { staff_user_id?: string; email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const rawEmail    = body.email ?? '';
  const staffUserId = body.staff_user_id ?? '';

  // Look up by ID or email
  const query = staffUserId
    ? supabaseAdmin.from('school_users').select('id, email, name, invite_status, auth_user_id, is_active').eq('id', staffUserId).eq('school_id', schoolId).maybeSingle()
    : supabaseAdmin.from('school_users').select('id, email, name, invite_status, auth_user_id, is_active').eq('email', sanitizeEmail(rawEmail)).eq('school_id', schoolId).maybeSingle();

  const { data: user } = await query;
  if (!user) return NextResponse.json({ error: 'Staff member not found in this school.' }, { status: 404 });
  if (!user.is_active) return NextResponse.json({ error: 'Staff account is inactive.' }, { status: 400 });

  const email = sanitizeEmail(user.email);
  if (!isValidEmail(email)) {
    await supabaseAdmin.from('school_users').update({ invite_status: 'failed' }).eq('id', user.id);
    return NextResponse.json({
      error: `Invalid email format: "${email}". Update the email address in Staff settings, then retry.`,
      code: 'INVALID_EMAIL',
    }, { status: 400 });
  }

  // Already has auth account
  if (user.auth_user_id) {
    return NextResponse.json({
      message: 'Staff member already has a login account.',
      invite_status: user.invite_status,
      already_provisioned: true,
    });
  }

  const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { school_id: schoolId, school_user_id: user.id, name: user.name },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.edprosys.com'}/login`,
  });

  if (inviteErr) {
    await supabaseAdmin.from('school_users').update({ invite_status: 'failed' }).eq('id', user.id);
    return NextResponse.json({ error: `Failed to send invitation: ${inviteErr.message}`, code: 'INVITE_FAILED' }, { status: 500 });
  }

  await supabaseAdmin.from('school_users').update({
    invite_status: 'invited',
    invite_sent_at: new Date().toISOString(),
    auth_user_id: inviteData.user?.id ?? null,
  }).eq('id', user.id);

  return NextResponse.json({
    success: true,
    message: `Invitation sent to ${email}. Staff will receive an email to set their password.`,
    email,
    invite_status: 'invited',
  });
}
