// app/api/admin/institution-config/route.ts
// Batch 4A — Institution feature flags + type read/write.
// Resolves institution via schools.institution_id → institutions.
// GET: returns feature_flags + institution_type + ownership_type for the school's institution.
// PATCH: merges feature_flags patch; optionally updates institution_type.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveInstitution(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from('schools')
    .select('institution_id, institutions(id, name, institution_type, ownership_type, feature_flags)')
    .eq('id', schoolId)
    .maybeSingle();
  if (error || !data) return null;
  const inst = Array.isArray(data.institutions) ? data.institutions[0] : data.institutions;
  return inst as { id: string; name: string; institution_type: string; ownership_type: string; feature_flags: Record<string, unknown> } | null;
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const inst = await resolveInstitution(ctx.schoolId);
  if (!inst) return NextResponse.json({ error: 'Institution not found for this school' }, { status: 404 });

  return NextResponse.json({
    institution_id: inst.id,
    institution_name: inst.name,
    institution_type: inst.institution_type,
    ownership_type: inst.ownership_type,
    feature_flags: inst.feature_flags ?? {},
  });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  if (!['owner','admin'].includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Only owner/admin can modify institution config' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const inst = await resolveInstitution(ctx.schoolId);
  if (!inst) return NextResponse.json({ error: 'Institution not found for this school' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (body.institution_type) update.institution_type = body.institution_type;
  if (body.feature_flags_patch && typeof body.feature_flags_patch === 'object') {
    // Merge: existing flags || patch
    update.feature_flags = { ...(inst.feature_flags ?? {}), ...(body.feature_flags_patch as Record<string, unknown>) };
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data: updated, error } = await supabaseAdmin
    .from('institutions').update(update).eq('id', inst.id).select('id, name, institution_type, ownership_type, feature_flags').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    institution_id: updated.id,
    institution_name: updated.name,
    institution_type: updated.institution_type,
    ownership_type: updated.ownership_type,
    feature_flags: updated.feature_flags ?? {},
  });
}
