// app/api/admin/onboarding/3-staff/route.ts
// Onboarding Step 3: Staff bulk import
// Body: { staff: [{ name, role, email, phone }] }
// role must be one of: admin | teacher | principal | counsellor
// Creates staff row + school_users row for each. Idempotent on email.
// Returns login credentials for each successfully created user so the
// onboarding UI can display them to the admin for distribution.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

const VALID_ROLES = new Set(['admin', 'teacher', 'principal', 'counsellor']);

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const staffList = (body.staff as { name: string; role: string; email?: string; phone?: string }[]) ?? [];
  if (!staffList.length) return NextResponse.json({ error: 'staff array required' }, { status: 400 });

  // The initial login password uses the same pattern as owner registration:
  // edprosys + first-4-chars-of-school-uuid
  // This is the ONE place where this is shown to the admin so they can
  // distribute it to staff. It is shown in the API response and surfaced
  // in the onboarding UI credential table.
  const initialPassword = `edprosys${schoolId.slice(0, 4)}`;

  let created = 0;
  const errors: string[] = [];
  const createdUsers: { name: string; email: string; role: string; password: string }[] = [];

  for (const s of staffList) {
    if (!s.name?.trim()) { errors.push('Row missing name'); continue; }

    const role = VALID_ROLES.has(s.role) ? s.role : 'teacher';
    const roleV2 = role === 'admin' ? 'admin_staff' : role;

    // Insert staff row
    const { data: staffRow, error: sErr } = await supabaseAdmin
      .from('staff')
      .insert({
        school_id: schoolId,
        name: s.name.trim(),
        role,
        phone: s.phone?.trim() ?? null,
        email: s.email?.trim().toLowerCase() ?? null,
        is_active: true,
      })
      .select('id')
      .single();

    if (sErr) { errors.push(`Staff insert failed for ${s.name}: ${sErr.message}`); continue; }

    // Insert school_users row if email provided
    if (s.email?.trim()) {
      const email = s.email.trim().toLowerCase();
      const { error: uErr } = await supabaseAdmin
        .from('school_users')
        .upsert({
          school_id: schoolId,
          email,
          name: s.name.trim(),
          role: role === 'teacher' ? 'teacher' : 'admin',
          role_v2: roleV2,
          staff_id: staffRow.id,
          is_active: true,
        }, { onConflict: 'school_id,email', ignoreDuplicates: true });

      if (uErr) {
        errors.push(`User insert for ${s.email}: ${uErr.message}`);
      } else {
        // Record credentials so admin can distribute them
        createdUsers.push({
          name: s.name.trim(),
          email,
          role,
          password: initialPassword,
        });
      }
    }
    created++;
  }

  return NextResponse.json({
    success: true,
    step: 3,
    created,
    errors,
    // Credential list — shown to admin in onboarding UI for distribution to staff
    // Each staff member should receive their email + this password.
    // They can use "Forgot password? Sign in with email link" to set their own access.
    credentials: createdUsers,
    credential_note: `All staff share the initial password shown above. Each person should sign in once, then use the email link option to set their own permanent access.`,
    initial_password: initialPassword,
  });
}
