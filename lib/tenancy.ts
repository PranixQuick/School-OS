// lib/tenancy.ts
// Phase 1 Task 1.3 — tenant context resolution with institution hierarchy.
//
// Previously (Phase 0 Task 0.2) this module exposed a flat `{school_id, ...}`
// context. Phase 1 extends the shape to the full hierarchy: organisation →
// institution → academic year → legacy school. Existing Phase 0 callers that
// only needed school_id can continue using `lib/getSchoolId.ts` (sync,
// header-based) or read `legacy_school_id` from this context.
//
// Caching strategy:
//   - React `cache()` wraps the public entrypoint → per-request dedup, so a
//     handler calling getTenantContext(req) multiple times hits the DB once.
//   - `unstable_cache` wraps the DB lookup keyed by userId with a 60s TTL →
//     cross-request dedup for the same user. Role/institution changes
//     propagate within 60s.

import type { NextRequest } from 'next/server';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getSession } from './auth';
import { supabaseAdmin } from './supabaseClient';

export interface TenantContext {
  organisation_id: string | null;
  institution_id: string | null;
  legacy_school_id: string;
  academic_year_id: string | null;
  user_role: string;
  user_id: string;
  staff_id?: string;
  email: string;
}

// DB-resolved slice of the context. Cached by userId with a 60s TTL.
interface TenantDbLookup {
  organisation_id: string | null;
  institution_id: string | null;
  academic_year_id: string | null;
  staff_id: string | null;
}

async function fetchTenantDbLookup(userId: string): Promise<TenantDbLookup> {
  // 1. school_users → institution_id (+ school_id for staff lookup fallback).
  const { data: user, error: userErr } = await supabaseAdmin
    .from('school_users')
    .select('id, school_id, institution_id, email, role')
    .eq('id', userId)
    .maybeSingle();

  if (userErr || !user) {
    return {
      organisation_id: null,
      institution_id: null,
      academic_year_id: null,
      staff_id: null,
    };
  }

  const institution_id = (user.institution_id as string | null) ?? null;

  // 2. institution → organisation_id (only if institution_id is linked).
  let organisation_id: string | null = null;
  if (institution_id) {
    const { data: inst } = await supabaseAdmin
      .from('institutions')
      .select('organisation_id')
      .eq('id', institution_id)
      .maybeSingle();
    organisation_id = (inst?.organisation_id as string | null) ?? null;
  }

  // 3. Current academic year for that institution.
  let academic_year_id: string | null = null;
  if (institution_id) {
    const { data: year } = await supabaseAdmin
      .from('academic_years')
      .select('id')
      .eq('institution_id', institution_id)
      .eq('is_current', true)
      .maybeSingle();
    academic_year_id = (year?.id as string | null) ?? null;
  }

  // 4. Optional staff_id for roles that commonly have one.
  let staff_id: string | null = null;
  const role = user.role as string | null;
  if (role && ['teacher', 'principal', 'admin_staff', 'owner'].includes(role)) {
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('school_id', user.school_id as string)
      .eq('email', user.email as string)
      .eq('is_active', true)
      .maybeSingle();
    if (staff?.id) staff_id = staff.id as string;
  }

  return { organisation_id, institution_id, academic_year_id, staff_id };
}

// Cross-request cache keyed by userId. 60s TTL — role/institution changes
// propagate within a minute. `unstable_cache` requires a serialisable return
// and stable tag/keys across server instances.
const cachedTenantDbLookup = unstable_cache(
  async (userId: string) => fetchTenantDbLookup(userId),
  ['tenancy-db-lookup-v1'],
  { revalidate: 60 }
);

// Public entrypoint. React.cache() gives per-request memoization so callers
// within one handler only trigger the DB lookup once.
export const getTenantContext = cache(
  async (req: NextRequest): Promise<TenantContext | null> => {
    const session = await getSession(req);
    if (!session) return null;

    // Defensive: fall back to session-only context if the DB lookup explodes.
    let db: TenantDbLookup = {
      organisation_id: null,
      institution_id: null,
      academic_year_id: null,
      staff_id: null,
    };
    try {
      db = await cachedTenantDbLookup(session.userId);
    } catch (err) {
      console.error('[tenancy] DB lookup failed, returning legacy-only context:', err);
    }

    return {
      organisation_id: db.organisation_id,
      institution_id: db.institution_id,
      legacy_school_id: session.schoolId,
      academic_year_id: db.academic_year_id,
      user_role: session.userRole,
      user_id: session.userId,
      staff_id: db.staff_id ?? undefined,
      email: session.userEmail,
    };
  }
);

// True if the school's feature flags enable strict RLS enforcement.
// Retained from Phase 0 Task 0.2 for the gradual supabaseAdmin → supabaseForUser
// migration path. Routes should use this gate once they move to the
// user-bound client.
export async function isRlsStrictEnabled(schoolId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('schools')
    .select('settings')
    .eq('id', schoolId)
    .maybeSingle();
  if (error || !data) return false;
  const settings = (data.settings ?? {}) as { feature_flags?: Record<string, unknown> };
  return settings.feature_flags?.rls_strict === true;
}
