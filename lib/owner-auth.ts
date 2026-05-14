// lib/owner-auth.ts
// Batch 4C — Owner session helper.
// Pattern mirrors lib/admin-auth.ts: reads middleware-injected headers.
// Owner role resolves ALL schools under the same institution via school_users.institution_id.
// supabaseAdmin intentional — cross-school boundary queries are owner's core use case.

import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export class OwnerAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OwnerAuthError';
    this.status = status;
  }
}

export interface OwnerContext {
  userId: string;
  userEmail: string;
  institutionId: string;
  institutionName: string;
  schoolIds: string[];
  schools: { school_id: string; school_name: string }[];
}

/**
 * Resolves the calling user's owner context from middleware-injected headers.
 * Looks up all schools the owner controls via institution_id.
 * Throws OwnerAuthError 401 if no session, 403 if not owner role.
 */
export async function requireOwnerSession(req: NextRequest): Promise<OwnerContext> {
  const schoolId  = req.headers.get('x-school-id');
  const userRole  = req.headers.get('x-user-role');
  const userEmail = req.headers.get('x-user-email');

  if (!schoolId || !userRole || !userEmail) throw new OwnerAuthError('No session', 401);
  if (userRole !== 'owner') throw new OwnerAuthError('Owner access required', 403);

  // Get this user's school_users record to find institution_id
  const { data: seedUser } = await supabaseAdmin
    .from('school_users')
    .select('id, institution_id, is_active')
    .eq('school_id', schoolId)
    .eq('email', userEmail)
    .eq('role_v2', 'owner')
    .maybeSingle();

  if (!seedUser) throw new OwnerAuthError('Owner account not found', 403);
  if (seedUser.is_active === false) throw new OwnerAuthError('Owner account inactive', 403);

  const institutionId = seedUser.institution_id;
  if (!institutionId) throw new OwnerAuthError('Owner not linked to an institution', 403);

  // Fetch institution name
  const { data: inst } = await supabaseAdmin
    .from('institutions')
    .select('id, name')
    .eq('id', institutionId)
    .maybeSingle();

  // Fetch all schools under this institution
  const { data: ownedSchools } = await supabaseAdmin
    .from('schools')
    .select('id, name')
    .eq('institution_id', institutionId)
    .eq('is_active', true);

  const schools = (ownedSchools ?? []).map(s => ({ school_id: s.id, school_name: s.name }));
  const schoolIds = schools.map(s => s.school_id);

  return {
    userId: seedUser.id,
    userEmail,
    institutionId,
    institutionName: inst?.name ?? 'Institution',
    schoolIds,
    schools,
  };
}
