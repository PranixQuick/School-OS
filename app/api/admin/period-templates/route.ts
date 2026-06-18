// app/api/admin/period-templates/route.ts
// ISS-3 (#3): list period templates for the admin school's institution type.
// Read-only; used by the subjects management UI to offer institution-appropriate
// non-core period kinds (App. A seed).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { getInstitutionForSchool } from '@/lib/tenant-lookup';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { institution_id } = await getInstitutionForSchool(ctx.schoolId);
  if (!institution_id) return NextResponse.json({ institution_type: null, templates: [] });

  const { data: inst } = await supabaseAdmin
    .from('institutions')
    .select('institution_type')
    .eq('id', institution_id)
    .maybeSingle();

  const institutionType = (inst?.institution_type as string | null) ?? null;
  if (!institutionType) return NextResponse.json({ institution_type: null, templates: [] });

  const { data, error } = await supabaseAdmin
    .from('period_templates')
    .select('id, kind, default_name, default_minutes, sort_order')
    .eq('institution_type', institutionType)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ institution_type: institutionType, templates: data ?? [] });
}
