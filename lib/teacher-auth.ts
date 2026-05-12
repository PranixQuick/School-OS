// lib/teacher-auth.ts
// Item #1 Track C — Teacher Dashboard (OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD).
//
// Auth helper for /api/teacher/* and /teacher/* routes.
//
// Replaces the prior phone+PIN-per-request anti-pattern (Items 9-13) with a
// proper session-based flow:
//   1. Teacher logs in via /api/auth/login (existing endpoint, no new login API)
//   2. Session JWT cookie is set, middleware injects x-school-id / x-user-role
//   3. Each /api/teacher route calls requireTeacherSession(req) -> resolves
//      staff_id by joining session.userId to school_users -> rejects if not
//      role='teacher' or no staff_id linkage
//
// Tenant boundary is enforced by RLS at the Postgres layer (current_teacher_staff_id()
// SQL function + additive auth_read_teacher policies). This file's job is to surface
// session.userId + staff_id to route handlers so they can pass the correct values
// when binding to supabaseForUser().

import type { NextRequest } from 'next/server';
import { getSession, type SchoolSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export class TeacherAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TeacherAuthError';
    this.status = status;
  }
}

export interface TeacherContext {
  session: SchoolSession;
  staffId: string;
  schoolId: string;
}

/**
 * Resolves the calling teacher's session + staff_id.
 *
 * Throws TeacherAuthError with status 401 if there is no session,
 * 403 if the user's role is not 'teacher', or 403 if the school_users row
 * has no staff_id linkage (misconfigured account).
 *
 * Route handlers should:
 *   try { const ctx = await requireTeacherSession(req); ... }
 *   catch (e) {
 *     if (e instanceof TeacherAuthError) return new Response(e.message, { status: e.status });
 *     throw e;
 *   }
 */
export async function requireTeacherSession(req: NextRequest): Promise<TeacherContext> {
  const session = await getSession(req);
  if (!session) {
    throw new TeacherAuthError('No session', 401);
  }
  if (session.userRole !== 'teacher') {
    throw new TeacherAuthError('Not a teacher account', 403);
  }

  // Look up staff_id from school_users by school_users.id (= session.userId).
  // We use supabaseAdmin here ONLY for this lookup — the actual data queries
  // in route handlers should use supabaseForUser() bound to the Supabase auth
  // access token so RLS applies. See lib/supabaseClient.ts for the migration plan.
  const { data, error } = await supabaseAdmin
    .from('school_users')
    .select('staff_id, school_id, is_active')
    .eq('id', session.userId)
    .single();

  if (error || !data) {
    throw new TeacherAuthError('Teacher account not found', 403);
  }
  if (data.is_active === false) {
    throw new TeacherAuthError('Teacher account is inactive', 403);
  }
  if (!data.staff_id) {
    throw new TeacherAuthError('Teacher account missing staff linkage', 403);
  }
  // Defensive: session.schoolId must match school_users.school_id.
  if (data.school_id !== session.schoolId) {
    throw new TeacherAuthError('Tenant mismatch', 403);
  }

  return {
    session,
    staffId: data.staff_id,
    schoolId: data.school_id,
  };
}

/**
 * Convenience: returns staff_id only, or null if not a teacher.
 * Use for non-throwing contexts (UI components fetched via Server Component).
 */
export async function getTeacherStaffId(req: NextRequest): Promise<string | null> {
  try {
    const ctx = await requireTeacherSession(req);
    return ctx.staffId;
  } catch {
    return null;
  }
}
