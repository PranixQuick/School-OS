// app/api/v2/institutions/route.ts
// Phase 1 Task 1.5 — list and create institutions.
//
// GET  /api/v2/institutions
//   super_admin  → all institutions
//   owner/admin  → institutions in caller's organisation
//   null org     → empty list (backfill gap, surfaced by Task 1.6)
//
// POST /api/v2/institutions
//   Requires: name, slug, institution_type
//   Role gate: owner OR super_admin
//   Side-effect: auto-creates default academic_year + CBSE_K10 programme
//                for school_k10 institutions.

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenancy';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  isSuperAdmin,
  canManageInstitutions,
} from '@/lib/authz';
import {
  DEFAULT_TERM_STRUCTURE,
  DEFAULT_CBSE_GRADING_SCHEMA,
  currentAcademicYearLabel,
  academicYearDates,
} from '@/lib/institution-defaults';

const VALID_INSTITUTION_TYPES = [
  'school_k10', 'school_k12', 'junior_college', 'degree_college',
  'engineering', 'mba', 'medical', 'vocational', 'coaching',
] as const;

type InstitutionType = typeof VALID_INSTITUTION_TYPES[number];

export const dynamic = 'force-dynamic';

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const superAdmin = isSuperAdmin(ctx.email);

  if (!superAdmin && !ctx.organisation_id) {
    return NextResponse.json({ institutions: [] });
  }

  const query = supabaseAdmin
    .from('institutions')
    .select(`
      id, name, slug, institution_type, board, plan, is_active,
      onboarded_at, settings, feature_flags,
      organisations ( id, name, slug )
    `)
    .order('name');

  if (!superAdmin) {
    query.eq('organisation_id', ctx.organisation_id!);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[v2/institutions GET]', error.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({ institutions: data ?? [] });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!canManageInstitutions(ctx.user_role, ctx.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, slug, institution_type, board, affiliation_body, address,
          contact_email, contact_phone, plan, settings, feature_flags } = body as Record<string, string>;

  if (!name || !slug || !institution_type) {
    return NextResponse.json(
      { error: 'name, slug, and institution_type are required' },
      { status: 400 }
    );
  }

  if (!VALID_INSTITUTION_TYPES.includes(institution_type as InstitutionType)) {
    return NextResponse.json(
      { error: `institution_type must be one of: ${VALID_INSTITUTION_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // Resolve organisation_id: super_admin may supply it; others use their own.
  const superAdmin = isSuperAdmin(ctx.email);
  const organisation_id = superAdmin && body.organisation_id
    ? (body.organisation_id as string)
    : ctx.organisation_id;

  if (!organisation_id) {
    return NextResponse.json(
      { error: 'Cannot resolve organisation. Your account may not be linked to an institution.' },
      { status: 400 }
    );
  }

  // Insert institution
  const { data: institution, error: instErr } = await supabaseAdmin
    .from('institutions')
    .insert({
      organisation_id,
      name,
      slug,
      institution_type,
      board:            board ?? null,
      affiliation_body: affiliation_body ?? null,
      address:          address ?? null,
      contact_email:    contact_email ?? null,
      contact_phone:    contact_phone ?? null,
      plan:             plan ?? 'free',
      is_active:        true,
      settings:         settings ? JSON.parse(settings as unknown as string) : {},
      feature_flags:    feature_flags ? JSON.parse(feature_flags as unknown as string) : {},
    })
    .select()
    .single();

  if (instErr) {
    if (instErr.code === '23505') {
      return NextResponse.json(
        { error: 'An institution with this slug already exists in your organisation' },
        { status: 409 }
      );
    }
    console.error('[v2/institutions POST] insert institution:', instErr.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  // Auto-create defaults for school_k10
  if (institution_type === 'school_k10') {
    const ayLabel = currentAcademicYearLabel();
    const { start_date, end_date } = academicYearDates(ayLabel);

    const { data: ay, error: ayErr } = await supabaseAdmin
      .from('academic_years')
      .insert({
        institution_id: institution.id,
        label:          ayLabel,
        start_date,
        end_date,
        is_current:     true,
        term_structure: DEFAULT_TERM_STRUCTURE,
      })
      .select('id')
      .single();

    if (ayErr) {
      // Rollback institution to avoid orphan
      await supabaseAdmin.from('institutions').delete().eq('id', institution.id);
      console.error('[v2/institutions POST] insert academic_year:', ayErr.message);
      return NextResponse.json({ error: 'Failed to create default academic year' }, { status: 500 });
    }

    const { error: progErr } = await supabaseAdmin
      .from('programmes')
      .insert({
        institution_id: institution.id,
        code:           'CBSE_K10',
        name:           'CBSE Class 1-10',
        duration_years: 10,
        has_semesters:  false,
        credit_system:  false,
        grading_schema: DEFAULT_CBSE_GRADING_SCHEMA,
      });

    if (progErr) {
      // Rollback both institution + academic_year
      await supabaseAdmin.from('academic_years').delete().eq('id', ay.id);
      await supabaseAdmin.from('institutions').delete().eq('id', institution.id);
      console.error('[v2/institutions POST] insert programme:', progErr.message);
      return NextResponse.json({ error: 'Failed to create default programme' }, { status: 500 });
    }
  } else {
    // For non-school_k10: still create a default academic year, no default programme
    const ayLabel = currentAcademicYearLabel();
    const { start_date, end_date } = academicYearDates(ayLabel);

    const { error: ayErr } = await supabaseAdmin
      .from('academic_years')
      .insert({
        institution_id: institution.id,
        label:          ayLabel,
        start_date,
        end_date,
        is_current:     true,
        term_structure: DEFAULT_TERM_STRUCTURE,
      });

    if (ayErr) {
      await supabaseAdmin.from('institutions').delete().eq('id', institution.id);
      console.error('[v2/institutions POST] insert academic_year (non-k10):', ayErr.message);
      return NextResponse.json({ error: 'Failed to create default academic year' }, { status: 500 });
    }
  }

  return NextResponse.json({ institution }, { status: 201 });
}
