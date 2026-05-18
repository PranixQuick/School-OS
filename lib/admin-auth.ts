// lib/admin-auth.ts
// Admin auth helper for /api/admin/* routes.
//
// FIX: Was reading from x-school-id/x-user-role/x-user-email headers that
// middleware never injects. Now reads from the session cookie via getSession()
// exactly like requireTeacherSession and requirePrincipalSession do.

import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

export interface AdminContext {
  schoolId: string;
  userId: string;         // school_users.id
  staffId: string | null; // null for owner/accountant who may not have staff record
  userRole: string;
  userEmail: string;
}

const ALLOWED_ROLES = new Set(['owner', 'principal', 'admin_staff', 'admin', 'accountant']);

/**
 * Resolves the calling admin's context from the session cookie JWT.
 * Throws AdminAuthError 401 if no valid session, 403 if role not permitted.
 */
export async function requireAdminSession(req: NextRequest): Promise<AdminContext> {
  const session = await getSession(req);

  if (!session) {
    throw new AdminAuthError('No session', 401);
  }

  const { schoolId, userId, userRole, userEmail } = session;

  if (!ALLOWED_ROLES.has(userRole)) {
    throw new AdminAuthError(`Role '${userRole}' is not permitted for this action`, 403);
  }

  // Resolve school_users.id + staff_id for audit trail
  const { data: schoolUser, error } = await supabaseAdmin
    .from('school_users')
    .select('id, staff_id, is_active')
    .eq('school_id', schoolId)
    .eq('email', userEmail)
    .maybeSingle();

  if (error || !schoolUser) {
    throw new AdminAuthError('Admin account not found', 403);
  }
  if (schoolUser.is_active === false) {
    throw new AdminAuthError('Admin account is inactive', 403);
  }

  return {
    schoolId,
    userId: schoolUser.id,
    staffId: schoolUser.staff_id ?? null,
    userRole,
    userEmail,
  };
}
