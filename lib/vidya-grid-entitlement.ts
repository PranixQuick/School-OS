// lib/vidya-grid-entitlement.ts
// VG-1 (freemium) — Vidya Grid entitlement resolution.
//
// Effective plan for a student = the HIGHER of:
//   * the school plan (institutions.feature_flags.vidya_grid_plan), and
//   * any non-expired parent top-up (student_vidya_grid_subscriptions).
// Ordering: paid > free > none.
//
// Design mirrors lib/otp.ts + lib/csv-id-validation.ts: the PURE resolver
// (resolveVgEntitlement) takes already-fetched data and is fully unit-testable
// with NO mocks and NO '@/' imports. The async getter does the DB I/O (with the
// client lazy-imported, since vitest has no '@/' alias) and is FAIL-SAFE TO FREE
// — never paid, never throws — so a lookup failure can neither grant paid access
// nor hard-break access.

export type VgPlan = 'none' | 'free' | 'paid';
export type VgSource = 'school' | 'parent' | 'none';

export interface VgEntitlement {
  plan: VgPlan;
  paidActive: boolean;
  seatCap: number | null;
  source: VgSource;
}

// Minimal shapes the pure resolver needs (decoupled from DB row types).
export interface SchoolVgFlags {
  vidya_grid_plan?: VgPlan;
  vidya_grid_paid_until?: string | null;
  vidya_grid_seat_cap?: number | null;
}
export interface StudentVgSub {
  plan: 'paid';
  paid_until: string | null;   // null = no expiry
}

const FREE: VgEntitlement = { plan: 'free', paidActive: false, seatCap: null, source: 'none' };

function notExpired(paidUntil: string | null | undefined, now: Date): boolean {
  if (paidUntil == null) return true;          // null/undefined = no expiry
  const t = Date.parse(paidUntil);
  if (Number.isNaN(t)) return false;           // unparseable = treat as expired (fail-safe)
  return now.getTime() <= t;
}

/**
 * PURE resolver — no I/O, no imports. `now` injected for deterministic tests.
 * Returns the effective entitlement from already-fetched data.
 */
export function resolveVgEntitlement(
  schoolFlags: SchoolVgFlags | null | undefined,
  studentSubs: StudentVgSub[] | null | undefined,
  now: Date = new Date(),
): VgEntitlement {
  const flags = schoolFlags ?? {};
  const seatCap = typeof flags.vidya_grid_seat_cap === 'number' ? flags.vidya_grid_seat_cap : null;

  const schoolPlan: VgPlan = flags.vidya_grid_plan ?? 'none';
  const schoolPaidActive = schoolPlan === 'paid' && notExpired(flags.vidya_grid_paid_until ?? null, now);

  const studentPaidActive = (studentSubs ?? []).some(
    (s) => s && s.plan === 'paid' && notExpired(s.paid_until, now),
  );

  if (schoolPaidActive || studentPaidActive) {
    return { plan: 'paid', paidActive: true, seatCap, source: schoolPaidActive ? 'school' : 'parent' };
  }

  // Not paid: 'free' if the school has VG enabled at all (free, or an expired paid);
  // otherwise 'none' (VG was never enabled for this school -> hide the VG entry point).
  if (schoolPlan === 'free' || schoolPlan === 'paid') {
    return { plan: 'free', paidActive: false, seatCap, source: 'school' };
  }
  return { plan: 'none', paidActive: false, seatCap, source: 'none' };
}

/**
 * ASYNC getter — does the I/O then delegates to the pure resolver.
 * FAIL-SAFE: on ANY error returns FREE (never paid, never throws).
 * DB client + flags loader are lazy-imported so this module stays unit-testable.
 */
export async function getVidyaGridEntitlement(
  schoolId: string,
  studentId?: string,
): Promise<VgEntitlement> {
  try {
    const { getInstitutionFlags } = await import('@/lib/institution-flags');
    const flags = (await getInstitutionFlags(schoolId)) as SchoolVgFlags;

    let studentSubs: StudentVgSub[] = [];
    if (studentId) {
      const { supabaseAdmin } = await import('@/lib/supabaseClient');
      const { data, error } = await supabaseAdmin
        .from('student_vidya_grid_subscriptions')
        .select('plan, paid_until')
        .eq('student_id', studentId)
        .eq('school_id', schoolId);
      if (!error && Array.isArray(data)) studentSubs = data as StudentVgSub[];
    }

    return resolveVgEntitlement(flags, studentSubs, new Date());
  } catch (e) {
    console.warn('[vg-entitlement] resolve failed; defaulting to free:', (e as Error)?.message);
    return FREE;
  }
}
