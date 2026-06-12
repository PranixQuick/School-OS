// app/api/admin/staff/activate-login/route.ts
//
// Provision a usable login for a school_users account WITHOUT depending on email
// delivery. This closes the core onboarding gap: every account created through a
// real flow (self-registration, MEO grant, staff invite, CSV import) lands with
// auth_user_id = NULL and invite_status = 'pending', and CANNOT log in — the
// login route returns "your login is not yet active" and the only supported
// activation paths (magic-link / inviteUserByEmail) require an email the
// environment may not be able to deliver.
//
// This endpoint lets an authority-holder in either onboarding flow activate a
// login directly:
//   - GOVT  : MEO grants the principal -> principal/MEO activates it
//   - PRIVATE: owner self-registers   -> owner/admin activates principal/admin/staff
//
// It creates (or repairs) the Supabase Auth user with a KNOWN password, links
// auth_user_id, and flips invite_status to 'verified' — the same end state as the
// working demo accounts. Returns the credentials so the granting authority can
// hand them to the user (the offline equivalent of "set your password" email).
//
// Auth: caller must be owner | principal | admin | meo, and may only activate
// accounts within their OWN school. Idempotent: re-activating reports already_active.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const ALLOWED_CALLER_ROLES = new Set(['owner', 'principal', 'admin', 'meo']);

function sanitizeEmail(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').toLowerCase().trim();
}
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Generate a reasonable default password when the caller does not supply one.
// Format is human-typable for demos/handover, e.g. "Edpro-7f3a91".
function genPassword(): string {
  return 'Edpro-' + Math.random().toString(36).slice(2, 8);
}

// Find an existing Supabase Auth user by email by paging through admin.listUsers.
// (The admin API has no direct get-by-email; we page defensively but cheaply.)
async function findAuthUserByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const hit = data.users.find(u => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break; // last page
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!ALLOWED_CALLER_ROLES.has(session.userRole)) {
    return NextResponse.json(
      { error: `Role '${session.userRole}' cannot activate logins. Requires owner, principal, admin, or MEO.` },
      { status: 403 }
    );
  }

  let body: { school_user_id?: string; email?: string; password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const targetEmail = body.email ? sanitizeEmail(body.email) : '';
  const targetId = body.school_user_id?.trim() ?? '';
  if (!targetId && !targetEmail) {
    return NextResponse.json({ error: 'Provide school_user_id or email of the account to activate.' }, { status: 400 });
  }
  if (targetEmail && !isValidEmail(targetEmail)) {
    return NextResponse.json({ error: `Invalid email format: "${targetEmail}".` }, { status: 400 });
  }

  // Resolve the target login, confined to the caller's school.
  const sel = 'id, school_id, email, name, role, is_active, auth_user_id, invite_status';
  const { data: user, error: lookupErr } = await (targetId
    ? supabaseAdmin.from('school_users').select(sel).eq('id', targetId).eq('school_id', session.schoolId).maybeSingle()
    : supabaseAdmin.from('school_users').select(sel).eq('email', targetEmail).eq('school_id', session.schoolId).maybeSingle());

  if (lookupErr) return NextResponse.json({ error: `Lookup failed: ${lookupErr.message}` }, { status: 500 });
  if (!user) return NextResponse.json({ error: 'No matching account found in your school.' }, { status: 404 });
  if (!user.is_active) return NextResponse.json({ error: 'Account is inactive. Reactivate it before granting a login.' }, { status: 400 });

  const email = sanitizeEmail(user.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: `Account email "${email}" is not a valid format. Fix it before activating.` }, { status: 400 });
  }

  // Already provisioned — idempotent success (do not silently reset their password).
  if (user.auth_user_id) {
    return NextResponse.json({
      success: true, already_active: true, email,
      message: 'This account already has an active login.',
    });
  }

  const password = (typeof body.password === 'string' && body.password.length >= 8)
    ? body.password
    : genPassword();

  // Create the Supabase Auth user with the password pre-set and email confirmed,
  // so the user can log in immediately with no email round-trip.
  let authUserId: string | null = null;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { school_id: user.school_id, school_user_id: user.id, name: user.name },
  });

  if (createErr) {
    // Most common cause: an auth user for this email already exists (created by a
    // half-finished invite). Recover by locating it and setting the password.
    const existingId = await findAuthUserByEmail(email);
    if (!existingId) {
      return NextResponse.json({ error: `Could not create login: ${createErr.message}` }, { status: 500 });
    }
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
      password, email_confirm: true,
    });
    if (updErr) {
      return NextResponse.json({ error: `Could not set password on existing auth user: ${updErr.message}` }, { status: 500 });
    }
    authUserId = existingId;
  } else {
    authUserId = created.user?.id ?? null;
  }

  if (!authUserId) {
    return NextResponse.json({ error: 'Auth user provisioning returned no id.' }, { status: 500 });
  }

  // Link the auth user and mark the account verified — the working-account end state.
  const { error: linkErr } = await supabaseAdmin.from('school_users').update({
    auth_user_id:   authUserId,
    invite_status:  'verified',
    auth_verified:  true,
    invite_sent_at: new Date().toISOString(),
  }).eq('id', user.id).eq('school_id', session.schoolId);

  if (linkErr) {
    return NextResponse.json({ error: `Login created but linking failed: ${linkErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    activated: true,
    account: { email, role: user.role, name: user.name },
    credentials: { email, password },
    message: 'Login activated. Share these credentials with the user; they can sign in immediately.',
  });
}
