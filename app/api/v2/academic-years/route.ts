// app/api/v2/academic-years/route.ts
// Phase 1 Task 1.5 — list and create academic years.
//
// GET  /api/v2/academic-years[?institution_id=uuid]
//   Defaults to caller's institution_id.
//   super_admin may pass ?institution_id= to target another institution.
//
// POST /api/v2/academic-years
//   Requires: label, start_date, end_date, term_structure
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

  // Resolve institution_id: param override allowed for super_admin only
  let institution_id = ctx.institution_id;
  if (queryInstitutionId) {
    if (!isSuperAdmin(ctx.email) && queryInstitutionId !== ctx.institution_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    institution_id = queryInstitutionId;
  }

  if (!institution_id) {
    return NextResponse.json({ academic_years: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('academic_years')
    .select('id, label, start_date, end_date, is_current, term_structure, institution_id')
    .eq('institution_id', institution_id)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('[v2/academic-years GET]', error.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ academic_years: data ?? [] });
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

  const { label, start_date, end_date, term_structure, is_current } = body as Record<string, unknown>;

  if (!label || !start_date || !end_date || !term_structure) {
    return NextResponse.json(
      { error: 'label, start_date, end_date, and term_structure are required' },
      { status: 400 }
    );
  }

  // Resolve institution_id from body (super_admin override) or ctx
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
    .from('academic_years')
    .insert({
      institution_id,
      label,
      start_date,
      end_date,
      is_current: is_current ?? false,
      term_structure,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'An academic year with this label already exists for this institution' },
        { status: 409 }
      );
    }
    console.error('[v2/academic-years POST]', error.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ academic_year: data }, { status: 201 });
}
