// lib/owner-auth.ts
// Owner session helper.
// An Owner runs a TRUST / GROUP that can contain multiple institutions of
// different kinds (a school + a junior college + an engineering college, ...).
// The data model is: organisations -> institutions -> schools.
// This resolver returns EVERY active school across EVERY institution under the
// owner's organisation. It falls back to the owner's single institution if the
// organisation can't be resolved, so single-institution owners are unaffected.

import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
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
 * Resolves the calling user's owner context from the verified session.
 * Returns all schools the owner controls across their whole organisation.
 * Throws OwnerAuthError 401 if no session, 403 if not owner role.
 */
export async function requireOwnerSession(req: NextRequest): Promise<OwnerContext> {
  const session = await getSession(req);
  if (!session) throw new OwnerAuthError('No session', 401);
  const { schoolId, userEmail } = session;
  if (session.userRole !== 'owner') throw new OwnerAuthError('Owner access required', 403);

  // Owner's school_users record -> institution_id.
  // (We do NOT additionally filter on role_v2='owner': owners onboarded before
  // the registration fix have role_v2=NULL and would be wrongly rejected.)
  const { data: seedUser } = await supabaseAdmin
    .from('school_users')
    .select('id, institution_id, is_active')
    .eq('school_id', schoolId)
    .eq('email', userEmail)
    .maybeSingle();

  if (!seedUser) throw new OwnerAuthError('Owner account not found', 403);
  if (seedUser.is_active === false) throw new OwnerAuthError('Owner account inactive', 403);

  // institution_id may be NULL on pre-fix owner rows — fall back to the school's
  // institution_id so owner-only endpoints resolve for those accounts too.
  let institutionId = seedUser.institution_id as string | null;
  if (!institutionId) {
    const { data: sch } = await supabaseAdmin
      .from('schools')
      .select('institution_id')
      .eq('id', schoolId)
      .maybeSingle();
    institutionId = (sch?.institution_id as string | null) ?? null;
  }
  if (!institutionId) throw new OwnerAuthError('Owner not linked to an institution', 403);

  // Resolve the owner's ORGANISATION so they see every institution they own.
  const { data: instRow } = await supabaseAdmin
    .from('institutions')
    .select('id, name, organisation_id')
    .eq('id', institutionId)
    .maybeSingle();

  const organisationId = (instRow?.organisation_id as string | null) ?? null;

  // Every institution under the owner's organisation (fallback: just theirs).
  let institutionIds: string[] = [institutionId];
  if (organisationId) {
    const { data: orgInsts } = await supabaseAdmin
      .from('institutions')
      .select('id')
      .eq('organisation_id', organisationId);
    if (orgInsts && orgInsts.length) {
      institutionIds = orgInsts.map(i => i.id as string);
    }
  }

  // Every active school across those institutions.
  const { data: ownedSchools } = await supabaseAdmin
    .from('schools')
    .select('id, name')
    .in('institution_id', institutionIds)
    .eq('is_active', true);

  const schools = (ownedSchools ?? []).map(s => ({ school_id: s.id as string, school_name: s.name as string }));
  const schoolIds = schools.map(s => s.school_id);

  return {
    userId: seedUser.id,
    userEmail,
    institutionId,
    institutionName: instRow?.name ?? 'Institution',
    schoolIds,
    schools,
  };
}
