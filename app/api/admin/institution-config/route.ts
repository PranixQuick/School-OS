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
    .select('institution_id, name, plan, onboarded_at, settings')
    .eq('id', schoolId).maybeSingle();

  // Primary source: schools.settings JSONB (set by onboarding step 1)
  const settingsInstType = (school?.settings as Record<string,unknown>)?.['institution_type'] as string | undefined;
  const settingsOwnType  = (school?.settings as Record<string,unknown>)?.['ownership_type'] as string | undefined;
  const settingsFeatureFlags = (school?.settings as Record<string,unknown>)?.['feature_flags'] as Record<string,unknown> | undefined;

  // Secondary source: institutions table (for schools with institution_id FK)
  if (school?.institution_id) {
    const { data: institution } = await supabaseAdmin
      .from('institutions')
      .select('institution_type, ownership_type, feature_flags, board, name')
      .eq('id', school.institution_id).maybeSingle();

    return NextResponse.json({
      institution_type: institution?.institution_type ?? settingsInstType ?? 'school_k12',
      ownership_type:   institution?.ownership_type   ?? settingsOwnType  ?? 'private',
      feature_flags:    institution?.feature_flags ?? settingsFeatureFlags ?? {},
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
    feature_flags:    settingsFeatureFlags ?? {},
    board:            null,
    institution_name: school?.name ?? '',
    plan:             school?.plan ?? 'free',
    onboarded:        !!(school?.onboarded_at),
  });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { institution_type?: string; feature_flags_patch?: Record<string, unknown> };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('institution_id, settings')
    .eq('id', schoolId).maybeSingle();

  if (!school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 });
  }

  if (school.institution_id) {
    const { error } = await supabaseAdmin
      .from('institutions')
      .update({
        institution_type: body.institution_type,
        feature_flags: body.feature_flags_patch,
      })
      .eq('id', school.institution_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const currentSettings = (school.settings as Record<string, unknown>) || {};
    const newSettings = {
      ...currentSettings,
      institution_type: body.institution_type || currentSettings.institution_type,
      feature_flags: body.feature_flags_patch || currentSettings.feature_flags || {},
    };
    const { error } = await supabaseAdmin
      .from('schools')
      .update({ settings: newSettings })
      .eq('id', schoolId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
