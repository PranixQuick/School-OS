// app/api/v2/institutions/[id]/route.ts
// Phase 1 Task 1.5 — get single institution by id.
//
// GET /api/v2/institutions/:id
//   Returns 404 if not found.
//   Returns 403 if the institution is in a different organisation (non-super-admin).

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenancy';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isSuperAdmin } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: institution, error } = await supabaseAdmin
    .from('institutions')
    .select(`
      id, name, slug, institution_type, board, affiliation_body, address,
      contact_email, contact_phone, plan, is_active, onboarded_at,
      settings, feature_flags, organisation_id,
      organisations ( id, name, slug )
    `)
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    console.error('[v2/institutions/[id] GET]', error.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!institution) {
    return NextResponse.json({ error: 'Institution not found' }, { status: 404 });
  }

  // Access check: non-super-admin can only see their own organisation
  if (!isSuperAdmin(ctx.email) && institution.organisation_id !== ctx.organisation_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ institution });
}
