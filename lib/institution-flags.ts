// lib/institution-flags.ts
// Item #13 — Hybrid Fee Collection
//
// Shared helper to load institutions.feature_flags for a school.
// Used by admin + parent fee routes to enforce institution-level gating.
//
// Lookup chain: school_id → schools.institution_id → institutions.feature_flags
//
// Feature flags shape (all optional in jsonb):
//   fee_module_enabled:     boolean  (default false — deny unless explicitly true)
//   online_payment_enabled: boolean  (default false — Razorpay mode)
//   razorpay_key_id:        string   (school's OWN Razorpay key)
//   razorpay_key_secret:    string   (school's OWN Razorpay secret — never exposed to client)
//
// TODO(item-15): migrate callers to supabaseForUser when service-role audit lands.

import { supabaseAdmin } from '@/lib/supabaseClient';

export interface FeatureFlags {
  fee_module_enabled?: boolean;
  online_payment_enabled?: boolean;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
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
