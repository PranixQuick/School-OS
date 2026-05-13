// lib/admin-auth.ts
// Item #13 — Admin auth helper for fee management routes.
//
// Accepts roles: owner | principal | admin_staff | accountant
// Mirrors lib/principal-auth.ts pattern — reads session from middleware-injected
// headers (x-school-id, x-user-role, x-user-email) and resolves staff_id.
//
// TODO(item-15): migrate to supabaseForUser when service-role audit lands.

import type { NextRequest } from 'next/server';
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
 * Resolves the calling admin's context from middleware-injected headers.
 * The school session cookie is validated by middleware; headers are trusted.
 *
 * Throws AdminAuthError 401 if no session headers, 403 if role not permitted.
 */
export async function requireAdminSession(req: NextRequest): Promise<AdminContext> {
  const schoolId  = req.headers.get('x-school-id');
  const userRole  = req.headers.get('x-user-role');
  const userEmail = req.headers.get('x-user-email');

  if (!schoolId || !userRole || !userEmail) {
    throw new AdminAuthError('No session', 401);
  }

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
