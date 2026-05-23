// lib/institution-flags.ts
// Item #13 — Hybrid Fee Collection
// Bible Phase 3 Step 3.3 — Feature flag extension
//
// Shared helper to load institutions.feature_flags for a school.
// Used by admin + parent fee routes to enforce institution-level gating.
// Bible Phase 3 Step 3.3 extends the FeatureFlags shape with per-institution
// module visibility (modules_enabled), assessment model, attendance model,
// and progression model — defining the schema for future institution-type
// polymorphism without changing existing fee-gating behavior.
//
// Lookup chain: school_id → schools.institution_id → institutions.feature_flags
//
// Feature flags shape (all optional in jsonb):
//   fee_module_enabled:     boolean  (default false — deny unless explicitly true)
//   online_payment_enabled: boolean  (default false — Razorpay mode)
//   razorpay_key_id:        string   (school's OWN Razorpay key)
//   razorpay_key_secret:    string   (school's OWN Razorpay secret — never exposed to client)
//   modules_enabled:        object   (per-institution module visibility map; all sub-keys optional)
//   assessment_model:       enum     (cce | semester | annual | trade_test | play_based | test_series)
//   attendance_model:       enum     (daily | subject_wise | biometric | not_applicable)
//   progression_model:      enum     (auto_promotion | exam_based | credit_based | trade_completion | not_applicable)
//
// TODO(item-15): migrate callers to supabaseForUser when service-role audit lands.

import { supabaseAdmin } from '@/lib/supabaseClient';

/**
 * Per-institution module visibility. All fields optional — undefined means
 * "use the institution_type default" (the Layout / Dashboard polymorphism
 * already handles defaults per type). Setting a flag here overrides the
 * default for this specific institution.
 *
 * Bible Phase 3 Step 3.3 schema.
 */
export interface ModulesEnabled {
  attendance_subject_level?: boolean;   // true for 9+ classes; subject-level attendance UI
  homework?: boolean;                    // false for anganwadi, coaching (typically)
  report_cards?: boolean;                // false for coaching, anganwadi
  board_exams?: boolean;                 // true for school_k10, school_k12
  placement?: boolean;                   // true for college, engineering, polytechnic
  hostel?: boolean;                      // true for residential institutions
  library?: boolean;                     // true for school, college
  transport?: boolean;                   // true if transport service offered
  mdm?: boolean;                         // true for government schools, anganwadi
  rte?: boolean;                         // true for government, aided schools
  internships?: boolean;                 // true for college, engineering
  coaching_tests?: boolean;              // true for coaching, tuition
  anganwadi_tracking?: boolean;          // true for anganwadi only
  vidya_grid_integration?: boolean;      // true when VIDYA GRID is linked
  apaar_integration?: boolean;           // true for all (mandatory 2026)
}

export type AssessmentModel =
  | 'cce'            // Continuous & Comprehensive Evaluation (k10)
  | 'semester'       // College / higher-ed
  | 'annual'         // Single end-of-year exam
  | 'trade_test'     // ITI / vocational
  | 'play_based'     // Pre-school, anganwadi developmental tracking
  | 'test_series';   // Coaching centres

export type AttendanceModel =
  | 'daily'          // Default for k1-k8
  | 'subject_wise'   // k9+, college (per-period attendance)
  | 'biometric'      // Govt schools, larger institutions
  | 'not_applicable'; // Some anganwadi / informal settings

export type ProgressionModel =
  | 'auto_promotion'    // RTE-mandated for early grades
  | 'exam_based'        // Pass exam to advance
  | 'credit_based'      // College / university credits
  | 'trade_completion'  // ITI / certificate-based
  | 'not_applicable';

export interface FeatureFlags {
  // ── Existing (Item #13 Hybrid Fee Collection) ────────────────────────────
  fee_module_enabled?: boolean;
  online_payment_enabled?: boolean;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;

  // ── Bible Phase 3 Step 3.3 — Institution polymorphism schema ─────────────
  modules_enabled?: ModulesEnabled;
  assessment_model?: AssessmentModel;
  attendance_model?: AttendanceModel;
  progression_model?: ProgressionModel;

  // Allow forward-compatible fields (additional flags added later won't break callers)
  [key: string]: unknown;
}

/**
 * Returns the feature_flags JSONB for the institution that owns this school.
 * Returns an empty object if the institution or flags are not found (fail-open for
 * non-critical flags; callers must explicitly gate on fee_module_enabled).
 */
export async function getInstitutionFlags(schoolId: string): Promise<FeatureFlags> {
  // Step 1: resolve institution_id from schools
  const { data: school, error: schoolErr } = await supabaseAdmin
    .from('schools')
    .select('institution_id')
    .eq('id', schoolId)
    .maybeSingle();

  if (schoolErr || !school?.institution_id) {
    console.warn('[institution-flags] school not found or no institution_id:', schoolId, schoolErr?.message);
    return {};
  }

  // Step 2: fetch institution flags
  const { data: institution, error: instErr } = await supabaseAdmin
    .from('institutions')
    .select('feature_flags')
    .eq('id', school.institution_id)
    .maybeSingle();

  if (instErr || !institution) {
    console.warn('[institution-flags] institution not found:', school.institution_id, instErr?.message);
    return {};
  }

  return (institution.feature_flags as FeatureFlags) ?? {};
}

/**
 * Quick check: is the fee module enabled for this school?
 * Returns false if flags can't be loaded (fail-closed for fee access).
 */
export async function isFeeModuleEnabled(schoolId: string): Promise<boolean> {
  const flags = await getInstitutionFlags(schoolId);
  return flags.fee_module_enabled === true;
}

// ── Bible Phase 3 Step 3.3 — Helper accessors ────────────────────────────
// These let callers ask "is X module on for this school?" without each one
// re-implementing the optional-chaining + default logic. All read-only,
// non-throwing, and fail-open with `undefined` meaning "use institution_type
// default" (Layout.tsx and dashboard/page.tsx handle defaults per type).

/**
 * Returns the modules_enabled sub-object, or an empty object if unset.
 * Useful for callers that want to inspect multiple flags at once.
 */
export function getModulesEnabled(flags: FeatureFlags): ModulesEnabled {
  return flags.modules_enabled ?? {};
}

/**
 * Quick check for a specific module flag. Returns:
 *   - true  if explicitly enabled
 *   - false if explicitly disabled
 *   - undefined if not set (caller should fall back to institution_type default)
 *
 * Example:
 *   const flags = await getInstitutionFlags(schoolId);
 *   const homework = isModuleEnabled(flags, 'homework');
 *   if (homework === false) { return res.status(404).end(); }
 */
export function isModuleEnabled(flags: FeatureFlags, module: keyof ModulesEnabled): boolean | undefined {
  return flags.modules_enabled?.[module];
}
