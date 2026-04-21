// lib/tenant-lookup.ts
// Phase 1 Task 1.4 — service-context institution resolver.
//
// getInstitutionForSchool(schoolId) returns { institution_id, academic_year_id }
// for a legacy school_id. Used by dual-write paths that have a schoolId in
// hand (from the x-school-id header, from a cron loop, or from the connector
// engine) but no full NextRequest / user session.
//
// Caching: in-memory Map<schoolId, InstitutionContext>, populated lazily and
// kept for the process lifetime. The schools↔institutions mapping is stable
// post-backfill, so a cold start is a sufficient invalidator for Phase 1.
// No TTL, no bust path.
//
// Defensive behaviour: if the school has no linked institution, or the
// query fails, returns { institution_id: null, academic_year_id: null } and
// logs a console.warn. Callers must write NULL for those columns rather than
// throwing — the Task 1.6 consistency checker surfaces any orphans.

import { supabaseAdmin } from './supabaseClient';

export interface InstitutionContext {
  institution_id: string | null;
  academic_year_id: string | null;
}

const cache = new Map<string, InstitutionContext>();

export async function getInstitutionForSchool(
  schoolId: string
): Promise<InstitutionContext> {
  const cached = cache.get(schoolId);
  if (cached) return cached;

  let institution_id: string | null = null;
  let academic_year_id: string | null = null;

  try {
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .select('institution_id')
      .eq('id', schoolId)
      .maybeSingle();

    if (schoolErr) throw schoolErr;

    institution_id = (school?.institution_id as string | null) ?? null;

    if (institution_id) {
      const { data: year } = await supabaseAdmin
        .from('academic_years')
        .select('id')
        .eq('institution_id', institution_id)
        .eq('is_current', true)
        .maybeSingle();
      academic_year_id = (year?.id as string | null) ?? null;
    }
  } catch (err) {
    console.warn(
      `[tenant-lookup] institution lookup failed for school ${schoolId}:`,
      err instanceof Error ? err.message : err
    );
  }

  if (!institution_id) {
    console.warn(`[tenant-lookup] institution not found for school ${schoolId}`);
  }

  const result: InstitutionContext = { institution_id, academic_year_id };
  cache.set(schoolId, result);
  return result;
}

// Test / admin escape hatch. Not wired into any production code path.
export function clearInstitutionCache(): void {
  cache.clear();
}
