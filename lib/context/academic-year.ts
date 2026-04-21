// lib/context/academic-year.ts
// Phase 1 Task 1.7 — resolve current academic year for an institution.
//
// Primary: reads is_current=true flag from academic_years table.
// Fallback: if is_current flag is stale (no row flagged), derives the current
//           year from today's date using Indian AY convention (April–March).
//
// Used by:
//   - Student lifecycle event writes (institution_id + academic_year_id context)
//   - Any future route needing the current AY without a full TenantContext

import { supabaseAdmin } from '@/lib/supabaseClient';
import { currentAcademicYearLabel, academicYearDates } from '@/lib/institution-defaults';

export interface AcademicYearContext {
  id: string;
  label: string;
  institution_id: string;
  is_current: boolean;
  start_date: string;
  end_date: string;
}

/**
 * Resolves the current academic year for the given institution.
 * Returns null if the institution doesn't exist or has no academic years.
 *
 * Strategy:
 *   1. Try is_current=true — fast path, hits the partial index.
 *   2. Fall back to matching today's date range (start_date ≤ today ≤ end_date).
 *   3. Fall back to the most recent AY by start_date.
 */
export async function resolveCurrentAcademicYear(
  institutionId: string
): Promise<AcademicYearContext | null> {
  // Pass 1 — is_current flag
  const { data: current } = await supabaseAdmin
    .from('academic_years')
    .select('id, label, institution_id, is_current, start_date, end_date')
    .eq('institution_id', institutionId)
    .eq('is_current', true)
    .maybeSingle();

  if (current) return current as AcademicYearContext;

  // Pass 2 — date range match (stale flag scenario)
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const { data: byDate } = await supabaseAdmin
    .from('academic_years')
    .select('id, label, institution_id, is_current, start_date, end_date')
    .eq('institution_id', institutionId)
    .lte('start_date', today)
    .gte('end_date', today)
    .maybeSingle();

  if (byDate) return byDate as AcademicYearContext;

  // Pass 3 — most recent
  const { data: latest } = await supabaseAdmin
    .from('academic_years')
    .select('id, label, institution_id, is_current, start_date, end_date')
    .eq('institution_id', institutionId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latest as AcademicYearContext | null) ?? null;
}

/**
 * Records a student lifecycle transition.
 * Silently logs errors rather than throwing — lifecycle events must never
 * block the primary operation that triggered them.
 */
export async function recordLifecycleEvent(params: {
  student_id: string;
  school_id: string;
  institution_id: string | null;
  academic_year_id: string | null;
  from_status: string | null;
  to_status: string;
  triggered_by?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('student_lifecycle_events')
    .insert({
      student_id:       params.student_id,
      school_id:        params.school_id,
      institution_id:   params.institution_id,
      academic_year_id: params.academic_year_id,
      from_status:      params.from_status ?? null,
      to_status:        params.to_status,
      triggered_by:     params.triggered_by ?? null,
      notes:            params.notes ?? null,
      metadata:         params.metadata ?? {},
    });

  if (error) {
    console.error(
      '[lifecycle] failed to record event',
      { student: params.student_id, transition: `${params.from_status}→${params.to_status}` },
      error.message
    );
  }
}
