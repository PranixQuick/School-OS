// app/api/auth/switch-school/route.ts
// Lets an Owner switch the active institution (school) in their session so they
// can manage any institution across their organisation. Validates the target
// belongs to the owner's org, auto-provisions the owner into that school if they
// don't have a row there yet, then re-issues the session cookie for that school.
// Also used by the onboard flow to jump straight into a newly created institution.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { requireOwnerSession, OwnerAuthError } from '@/lib/owner-auth';
import { issueSession, sessionCookie } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  let ctx;
  try {
    ctx = await requireOwnerSession(req);
  } catch (e) {
    if (e instanceof OwnerAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  let schoolId: string | undefined;
  try {
    const body = await req.json() as { schoolId?: string };
    schoolId = body.schoolId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!schoolId) return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
  if (!ctx.schoolIds.includes(schoolId)) {
    return NextResponse.json({ error: 'That institution is not in your organisation.' }, { status: 403 });
  }

  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('id, name, slug, plan, institution_id')
    .eq('id', schoolId)
    .maybeSingle();
  if (!school) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  // Ensure the owner has a school_users row in the target school so admin routes
  // (which look the user up by school_id + email) resolve after the switch.
  const { data: existing } = await supabaseAdmin
    .from('school_users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('email', ctx.userEmail)
    .maybeSingle();

  let activeUserId = existing?.id as string | undefined;

  if (!activeUserId) {
    // Reuse the owner's existing auth identity so the new row is a real login.
    const { data: anyOwnerRow } = await supabaseAdmin
      .from('school_users')
      .select('auth_user_id')
      .eq('email', ctx.userEmail)
      .not('auth_user_id', 'is', null)
      .limit(1)
      .maybeSingle();

    const { data: created, error: insErr } = await supabaseAdmin
      .from('school_users')
      .insert({
        school_id: schoolId,
        institution_id: school.institution_id,
        email: ctx.userEmail,
        role: 'owner',
        is_active: true,
        auth_user_id: anyOwnerRow?.auth_user_id ?? null,
      })
      .select('id')
      .single();

    if (insErr || !created) {
      return NextResponse.json({ error: 'Could not grant access to that institution.' }, { status: 500 });
    }
    activeUserId = created.id;
  }

  const token = await issueSession({
    userId: activeUserId,
    schoolId: school.id,
    userEmail: ctx.userEmail,
    userRole: session.userRole,
    schoolName: school.name ?? '',
    schoolSlug: school.slug ?? '',
    plan: school.plan ?? 'starter',
    userName: session.userName,
  });

  const cookieStore = await cookies();
  const opts = sessionCookie(token, process.env.NODE_ENV === 'production');
  cookieStore.set(opts.name, opts.value, opts);

  return NextResponse.json({ success: true, redirectTo: '/dashboard', school: { id: school.id, name: school.name } });
}
