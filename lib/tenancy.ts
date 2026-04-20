// lib/tenancy.ts
// Phase 0 Task 0.2 — tenant context resolution + rls_strict feature-flag read.

import type { NextRequest } from 'next/server';
import { getSession } from './auth';
import { supabaseAdmin } from './supabaseClient';

export interface TenantContext {
  school_id: string;
  user_role: string;
  user_id: string;
  user_email: string;
  // Present only when the logged-in user is linked to a staff row in their school.
  staff_id?: string;
}

// Resolve the tenant context for the current request by reading and verifying
// the session cookie. Returns null when there is no valid session.
export async function getTenantContext(req: NextRequest): Promise<TenantContext | null> {
  const session = await getSession(req);
  if (!session) return null;

  const ctx: TenantContext = {
    school_id: session.schoolId,
    user_role: session.userRole,
    user_id: session.userId,
    user_email: session.userEmail,
  };

  // Lightweight staff lookup for roles that commonly carry one. Misses are fine.
  if (['teacher', 'principal', 'admin_staff', 'owner'].includes(session.userRole)) {
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('school_id', session.schoolId)
      .eq('email', session.userEmail)
      .eq('is_active', true)
      .maybeSingle();
    if (staff?.id) ctx.staff_id = staff.id as string;
  }

  return ctx;
}

// True if the school's feature flags enable strict RLS enforcement.
// Routes should use this to decide between supabaseForUser (strict) and
// supabaseAdmin (permissive) while the rollout is in progress.
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
