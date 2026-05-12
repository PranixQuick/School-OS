// lib/principal-auth.ts
// Item #6 — Principal Dashboard minimum additions.
//
// Auth helper for /api/principal/* routes. Mirrors lib/teacher-auth.ts pattern.
//
// Flow:
//   1. Principal logs in via /api/auth/login (existing endpoint)
//   2. Session JWT cookie is set, middleware injects x-school-id / x-user-role
//   3. /api/principal/* routes call requirePrincipalSession(req) -> resolves
//      staff_id by joining session.userId to school_users with role_v2='principal'
//
// Tenant boundary enforced by app-code explicit .eq('school_id') + additive RLS
// policies (auth_read_principal_*, auth_update_principal_*) at the Postgres layer.
//
// TODO(item-15): migrate calling routes to supabaseForUser when service-role audit lands.

import type { NextRequest } from 'next/server';
import { getSession, type SchoolSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export class PrincipalAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PrincipalAuthError';
    this.status = status;
  }
}

export interface PrincipalContext {
  session: SchoolSession;
  staffId: string;
  schoolId: string;
}

/**
 * Resolves the calling principal's session + staff_id.
 *
 * Throws PrincipalAuthError with status 401 if no session,
 * 403 if the user's role is not 'principal' or has no staff_id linkage.
 */
export async function requirePrincipalSession(req: NextRequest): Promise<PrincipalContext> {
  const session = await getSession(req);
  if (!session) {
    throw new PrincipalAuthError('No session', 401);
  }
  if (session.userRole !== 'principal') {
    throw new PrincipalAuthError('Not a principal account', 403);
  }

  const { data, error } = await supabaseAdmin
    .from('school_users')
    .select('staff_id, school_id, is_active')
    .eq('id', session.userId)
    .single();

  if (error || !data) {
    throw new PrincipalAuthError('Principal account not found', 403);
  }
  if (data.is_active === false) {
    throw new PrincipalAuthError('Principal account is inactive', 403);
  }
  if (!data.staff_id) {
    throw new PrincipalAuthError('Principal account missing staff linkage', 403);
  }
  if (data.school_id !== session.schoolId) {
    throw new PrincipalAuthError('Tenant mismatch', 403);
  }

  return {
    session,
    staffId: data.staff_id,
    schoolId: data.school_id,
  };
}
