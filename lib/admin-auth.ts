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
  userId: string;
  staffId: string | null;
  userRole: string;
  userEmail: string;
}

// Roles that can access admin API routes.
// viewer: read-only access enforced at API level (GET only, no mutations).
// counsellor: access to student data, leave requests, parent interactions.
const ALLOWED_ROLES = new Set([
  'owner', 'principal', 'admin_staff', 'admin',
  'accountant', 'viewer', 'counsellor',
]);

export async function requireAdminSession(req: NextRequest): Promise<AdminContext> {
  const session = await getSession(req);
  if (!session) throw new AdminAuthError('No session', 401);

  const { schoolId, userId, userRole, userEmail } = session;

  if (!ALLOWED_ROLES.has(userRole)) {
    throw new AdminAuthError(`Role '${userRole}' is not permitted for this action`, 403);
  }

  // Viewer: only allow GET requests
  if (userRole === 'viewer' && req.method !== 'GET') {
    throw new AdminAuthError('Viewer role is read-only', 403);
  }

  const { data: schoolUser, error } = await supabaseAdmin
    .from('school_users')
    .select('id, staff_id, is_active')
    .eq('school_id', schoolId)
    .eq('email', userEmail)
    .maybeSingle();

  if (error || !schoolUser) throw new AdminAuthError('Admin account not found', 403);
  if (schoolUser.is_active === false) throw new AdminAuthError('Admin account is inactive', 403);

  return {
    schoolId,
    userId: schoolUser.id,
    staffId: schoolUser.staff_id ?? null,
    userRole,
    userEmail,
  };
}

// Non-throwing helper for pages that want to check role without error
export async function getAdminRole(req: NextRequest): Promise<string | null> {
  try {
    const ctx = await requireAdminSession(req);
    return ctx.userRole;
  } catch {
    return null;
  }
}
