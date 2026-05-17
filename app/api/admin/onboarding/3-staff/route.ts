// app/api/admin/onboarding/3-staff/route.ts
// Onboarding Step 3: Staff bulk import
// Fixes:
//   - W-2: institution_id now set on staff rows
//   - Automation B6: dispatches welcome notification (non-blocking fire-and-forget)
//   - Build fix: use void async IIFE instead of .then().catch() — Supabase QueryBuilder
//     returns PromiseLike, not a native Promise, so .catch() does not exist on the type
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

  // Resolve institution_id for this school (W-2 fix: was null before)
  const { data: schoolRow } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const institutionId = schoolRow?.institution_id ?? null;

  const initialPassword = `edprosys${schoolId.slice(0, 4)}`;

  let created = 0;
  const errors: string[] = [];
  const createdUsers: { name: string; email: string; role: string; password: string }[] = [];

  for (const s of staffList) {
    if (!s.name?.trim()) { errors.push('Row missing name'); continue; }

    const role = VALID_ROLES.has(s.role) ? s.role : 'teacher';
    const roleV2 = role === 'admin' ? 'admin_staff' : role;

    const { data: staffRow, error: sErr } = await supabaseAdmin
      .from('staff')
      .insert({
        school_id: schoolId,
        institution_id: institutionId,
        name: s.name.trim(),
        role,
        phone: s.phone?.trim() ?? null,
        email: s.email?.trim().toLowerCase() ?? null,
        is_active: true,
      })
      .select('id')
      .single();

    if (sErr) { errors.push(`Staff insert failed for ${s.name}: ${sErr.message}`); continue; }

    if (s.email?.trim()) {
      const email = s.email.trim().toLowerCase();
      const { error: uErr } = await supabaseAdmin
        .from('school_users')
        .upsert({
          school_id: schoolId,
          institution_id: institutionId,
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
        createdUsers.push({ name: s.name.trim(), email, role, password: initialPassword });

        // Automation B6: fire-and-forget welcome notification
        // Using void async IIFE — supabaseAdmin.from().insert() returns PromiseLike
        // (not a native Promise), so .catch() is not available on the type.
        void (async () => {
          try {
            await supabaseAdmin.from('notifications').insert({
              school_id: schoolId,
              type: 'staff_welcome',
              title: 'Welcome to EdProSys',
              message: `Hello ${s.name.trim()}, your ${role} account has been created. Login at edprosys.com with email: ${email} and password: ${initialPassword}. Use the email link option to set up secure access.`,
              module: 'onboarding',
              status: 'pending',
              channel: 'whatsapp',
              template_vars: {
                name: s.name.trim(),
                role,
                email,
                password: initialPassword,
                login_url: 'https://www.edprosys.com/login',
              },
            });
          } catch { /* non-blocking — notification failure must not fail staff creation */ }
        })();
      }
    }
    created++;
  }

  return NextResponse.json({
    success: true,
    step: 3,
    created,
    errors,
    credentials: createdUsers,
    credential_note: 'All staff share the initial password. Each person should sign in once, then use email link to secure their account.',
    initial_password: initialPassword,
  });
}
