import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { issueSession, sessionCookie } from '@/lib/session';
import { getSession, logAuthEvent, clientIpFromRequest } from '@/lib/auth';

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST to login.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);

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

  const { data: users, error: lookupErr } = await supabaseAdmin
    .from('school_users')
    .select('id, school_id, email, password_hash, role, is_active, staff_id, schools(name, slug, plan)')
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

  if (!user.password_hash) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, metadata: { reason: 'no_password_set' } });
    return NextResponse.json({ error: 'Password not set.', code: 'USE_MAGIC_LINK' }, { status: 401 });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    await logAuthEvent({ eventType: 'login_failure', email, ip, metadata: { reason: 'wrong_password' } });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const schoolRow = Array.isArray(user.schools) ? user.schools[0] : user.schools;
  const schoolName = (schoolRow as { name?: string } | null)?.name ?? '';
  const schoolSlug = (schoolRow as { slug?: string } | null)?.slug ?? '';
  const plan = (schoolRow as { plan?: string } | null)?.plan ?? 'starter';

  let userName = email.split('@')[0];
  if (user.staff_id) {
    const { data: staffRow } = await supabaseAdmin
      .from('staff').select('name').eq('id', user.staff_id).single();
    if (staffRow?.name) userName = staffRow.name;
  }

  const token = await issueSession({
    userId: user.id, schoolId: user.school_id,
    userEmail: user.email, userRole: user.role,
    schoolName, schoolSlug, plan, userName,
  });

  const cookieStore = await cookies();
  const cookieOpts = sessionCookie(token, process.env.NODE_ENV === 'production');
  cookieStore.set(cookieOpts.name, cookieOpts.value, cookieOpts);

  await logAuthEvent({ eventType: 'login_success', email, ip, metadata: { role: user.role, school_id: user.school_id } });

  return NextResponse.json({ success: true, redirectTo: roleRedirect(user.role), role: user.role });
}

function roleRedirect(role: string): string {
  switch (role) {
    case 'teacher':    return '/teacher';
    case 'principal':  return '/principal';
    case 'student':    return '/student';
    // viewer + counsellor + accountant all go to the dashboard
    // viewer is read-only enforced at API level, not by routing
    default:           return '/dashboard';
  }
}
