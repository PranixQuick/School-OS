// app/api/admin/institution-config/route.ts
// Used by Layout.tsx to conditionally show/hide sidebar items based on institution type.
// Called once on mount, cached in component state.
// Also returns feature_flags for fee/payment gating.
//
// FIX: When institution_id is NULL (most schools), read institution_type from
// schools.settings JSONB (set by onboarding step 1). Previously returned
// 'school_k10' default for ALL schools with no institution_id, causing wrong nav gating.
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
    .select('institution_id, name, plan, onboarded_at, settings')
    .eq('id', schoolId).maybeSingle();

  // Primary source: schools.settings JSONB (set by onboarding step 1)
  const settingsInstType = (school?.settings as Record<string,unknown>)?.['institution_type'] as string | undefined;
  const settingsOwnType  = (school?.settings as Record<string,unknown>)?.['ownership_type'] as string | undefined;

  // Secondary source: institutions table (for schools with institution_id FK)
  if (school?.institution_id) {
    const { data: institution } = await supabaseAdmin
      .from('institutions')
      .select('institution_type, ownership_type, feature_flags, board, name')
      .eq('id', school.institution_id).maybeSingle();

    return NextResponse.json({
      institution_type: institution?.institution_type ?? settingsInstType ?? 'school_k12',
      ownership_type:   institution?.ownership_type   ?? settingsOwnType  ?? 'private',
      feature_flags:    institution?.feature_flags ?? {},
      board:            institution?.board ?? null,
      institution_name: institution?.name ?? school.name,
      plan:             school.plan,
      onboarded:        !!school.onboarded_at,
    });
  }

  // No institution_id — use schools.settings (the common case for all current schools)
  return NextResponse.json({
    institution_type: settingsInstType ?? 'school_k12',
    ownership_type:   settingsOwnType  ?? 'private',
    feature_flags:    {},
    board:            null,
    institution_name: school?.name ?? '',
    plan:             school?.plan ?? 'free',
    onboarded:        !!(school?.onboarded_at),
  });
}
