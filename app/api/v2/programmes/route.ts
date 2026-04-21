// app/api/v2/programmes/route.ts
// Phase 1 Task 1.5 — list and create programmes.
//
// GET  /api/v2/programmes[?institution_id=uuid]
//   Defaults to caller's institution_id.
//   super_admin may pass ?institution_id= to target another institution.
//
// POST /api/v2/programmes
//   Requires: code, name, grading_schema
//   Role gate: owner OR admin OR super_admin

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenancy';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isSuperAdmin, canManageAcademicEntities } from '@/lib/authz';

export const dynamic = 'force-dynamic';

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const queryInstitutionId = searchParams.get('institution_id');

  let institution_id = ctx.institution_id;
  if (queryInstitutionId) {
    if (!isSuperAdmin(ctx.email) && queryInstitutionId !== ctx.institution_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    institution_id = queryInstitutionId;
  }

  if (!institution_id) {
    return NextResponse.json({ programmes: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('programmes')
    .select('id, code, name, duration_years, has_semesters, credit_system, grading_schema, institution_id')
    .eq('institution_id', institution_id)
    .order('code');

  if (error) {
    console.error('[v2/programmes GET]', error.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ programmes: data ?? [] });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canManageAcademicEntities(ctx.user_role, ctx.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { code, name, grading_schema, duration_years, has_semesters, credit_system } =
    body as Record<string, unknown>;

  if (!code || !name || !grading_schema) {
    return NextResponse.json(
      { error: 'code, name, and grading_schema are required' },
      { status: 400 }
    );
  }

  const superAdmin = isSuperAdmin(ctx.email);
  const institution_id = superAdmin && body.institution_id
    ? (body.institution_id as string)
    : ctx.institution_id;

  if (!institution_id) {
    return NextResponse.json(
      { error: 'Cannot resolve institution. Your account may not be linked to an institution.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('programmes')
    .insert({
      institution_id,
      code,
      name,
      grading_schema,
      duration_years:  duration_years  ?? null,
      has_semesters:   has_semesters   ?? false,
      credit_system:   credit_system   ?? false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A programme with this code already exists for this institution' },
        { status: 409 }
      );
    }
    console.error('[v2/programmes POST]', error.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ programme: data }, { status: 201 });
}
