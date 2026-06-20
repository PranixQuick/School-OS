// lib/vidya-grid-consent.ts
// VG-4 (DPDP) — adaptive_learning_ai consent check for the Vidya Grid launch gate.
//
// Mirrors lib/otp.ts / lib/vidya-grid-entitlement.ts: a PURE function
// (latestConsentGranted) that is fully unit-testable with no I/O / no '@/'
// imports, plus an async getter that lazy-imports the DB client.
//
// FAIL-SAFE DIRECTION = DENY: unlike entitlement (which fails safe to *free*),
// consent fails safe to *not granted* — on any error or missing row the launch
// gate must treat consent as absent. This is the privacy-preserving default.

export const VG_CONSENT_PURPOSE = 'adaptive_learning_ai' as const;

export interface ConsentRow {
  status: string;        // 'granted' | 'withdrawn' | 'pending'
  created_at: string;    // ISO
}

/**
 * PURE: given consent rows (any order) for ONE purpose, is the most recent
 * one 'granted'? Empty/missing => false.
 */
export function latestConsentGranted(rows: ConsentRow[] | null | undefined): boolean {
  if (!rows || rows.length === 0) return false;
  let latest = rows[0];
  for (const r of rows) {
    if (Date.parse(r.created_at) > Date.parse(latest.created_at)) latest = r;
  }
  return latest.status === 'granted';
}

/**
 * ASYNC: has this parent (for this school) most-recently GRANTED the
 * adaptive_learning_ai consent? Fail-safe to false (deny) on any error.
 */
export async function hasAdaptiveLearningConsent(parentId: string, schoolId: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabaseClient');
    const { data, error } = await supabaseAdmin
      .from('parent_consent_log')
      .select('status, created_at')
      .eq('parent_id', parentId)
      .eq('school_id', schoolId)
      .eq('consent_type', VG_CONSENT_PURPOSE)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data) return false;
    return latestConsentGranted(data as ConsentRow[]);
  } catch {
    return false;
  }
}

/**
 * Student-keyed consent check (for student-initiated launches): resolves the
 * student's parent rows, then returns whether the most-recent adaptive_learning_ai
 * action across them is 'granted'. Fail-safe to false (deny) on any error.
 */
export async function hasAdaptiveLearningConsentForStudent(studentId: string, schoolId: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabaseClient');
    const { data: parents } = await supabaseAdmin
      .from('parents').select('id').eq('student_id', studentId).eq('school_id', schoolId);
    const ids = (parents ?? []).map((p) => p.id);
    if (ids.length === 0) return false;

    const { data, error } = await supabaseAdmin
      .from('parent_consent_log')
      .select('status, created_at')
      .in('parent_id', ids)
      .eq('consent_type', VG_CONSENT_PURPOSE)
      .order('created_at', { ascending: false });
    if (error || !data) return false;
    return latestConsentGranted(data as ConsentRow[]);
  } catch {
    return false;
  }
}
