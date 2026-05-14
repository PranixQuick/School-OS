// app/api/admin/regulatory/setup/route.ts
// Batch 5A — Auto-map regulatory sources to institution based on institution_type + ownership_type.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const SOURCE_MAP: Record<string, string[]> = {
  school_k10_private:      ['CBSE_ACADEMIC','CBSE_EXAM','NCERT','BSE_TELANGANA'],
  school_k12_private:      ['CBSE_ACADEMIC','CBSE_EXAM','NCERT','BSE_TELANGANA'],
  school_k10_government:   ['BSE_TELANGANA','NCERT','ICDS_WCD','NSP'],
  school_k10_govt_aided:   ['BSE_TELANGANA','NCERT','ICDS_WCD','NSP'],
  school_k12_government:   ['BSE_TELANGANA','NCERT','ICDS_WCD','NSP'],
  school_k12_govt_aided:   ['BSE_TELANGANA','NCERT','ICDS_WCD','NSP'],
  govt_school:             ['BSE_TELANGANA','NCERT','ICDS_WCD','NSP'],
  junior_college:          ['BSE_TELANGANA','UGC'],
  degree_college:          ['UGC','NCERT'],
  engineering_college:     ['AICTE','JNTUH','UGC'],
  anganwadi:               ['ICDS_WCD','NSP'],
  coaching_centre:         ['CBSE_ACADEMIC','CBSE_EXAM'],
};

const DEFAULT_SOURCES = ['CBSE_ACADEMIC','NCERT'];

function getSources(institutionType: string, ownershipType: string): string[] {
  // Try specific key first, then fall back to type-only
  const specificKey = `${institutionType}_${ownershipType}`;
  const typeKey = institutionType;
  return SOURCE_MAP[specificKey] ?? SOURCE_MAP[typeKey] ?? DEFAULT_SOURCES;
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  // Get institution for this school
  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'School has no linked institution' }, { status: 400 });
  const institutionId = school.institution_id;

  // Get institution type + ownership
  const { data: institution } = await supabaseAdmin
    .from('institutions')
    .select('institution_type, ownership_type')
    .eq('id', institutionId)
    .maybeSingle();
  if (!institution) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  const institutionType = institution.institution_type ?? 'unknown';
  const ownershipType = institution.ownership_type ?? 'private';

  let sources = getSources(institutionType, ownershipType);

  // Always add ICSE if institution board is ICSE (check name/type heuristic)
  if (institutionType.includes('icse') || ownershipType.includes('icse')) {
    if (!sources.includes('ICSE')) sources = ['ICSE', ...sources];
  }

  // Upsert all mapped sources
  const rows = sources.map((source_code, idx) => ({
    institution_id: institutionId,
    source_code,
    is_primary: idx === 0,
    added_by: 'auto',
  }));

  const { error } = await supabaseAdmin
    .from('institution_source_map')
    .upsert(rows, { onConflict: 'institution_id,source_code', ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reset last_scraped_at so next scheduled run picks them up immediately
  await supabaseAdmin.from('regulatory_sources')
    .update({ last_scraped_at: null })
    .in('source_code', sources);

  return NextResponse.json({ mapped_sources: sources, institution_type: institutionType, ownership_type: ownershipType });
}
