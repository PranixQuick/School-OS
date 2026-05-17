// app/api/admin/institution-config/route.ts
// Used by Layout.tsx to conditionally show/hide sidebar items based on institution type.
// Called once on mount, cached in component state.
// Also returns feature_flags for fee/payment gating.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('institution_id, name, plan, onboarded_at')
    .eq('id', schoolId).maybeSingle();

  if (!school?.institution_id) {
    return NextResponse.json({ institution_type: 'school_k10', feature_flags: {}, onboarded: false });
  }

  const { data: institution } = await supabaseAdmin
    .from('institutions')
    .select('institution_type, ownership_type, feature_flags, board, name')
    .eq('id', school.institution_id).maybeSingle();

  return NextResponse.json({
    institution_type: institution?.institution_type ?? 'school_k10',
    ownership_type:   institution?.ownership_type ?? 'private',
    feature_flags:    institution?.feature_flags ?? {},
    board:            institution?.board ?? null,
    institution_name: institution?.name ?? school.name,
    plan:             school.plan,
    onboarded:        !!school.onboarded_at,
  });
}
