// app/api/admin/onboarding/7-activate/route.ts
// OPS-5: precondition guard — cannot activate with 0 staff + 0 academic structure + 0 subjects + 0 students
//
// Academic structure check is INSTITUTION-TYPE AWARE:
//   - School types (school_k10, school_k12, govt_*): requires classes > 0
//   - College/higher-ed types: requires batches > 0 (they never have classes rows)
//   - Coaching: requires batches > 0
//   - Anganwadi / vocational: classes OR batches > 0 (either accepted)
//
// DPDP GUARD: all legal documents must be accepted before activation.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

// Types that use batches instead of classes
const BATCH_TYPES = new Set([
  'coaching', 'junior_college', 'degree_college', 'engineering',
  'polytechnic', 'mba', 'medical', 'university', 'vocational',
]);

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const institutionId = school?.institution_id ?? null;

  // Resolve institution type for context-aware checks
  let institutionType = 'school_k10';
  if (institutionId) {
    const { data: inst } = await supabaseAdmin
      .from('institutions').select('institution_type').eq('id', institutionId).maybeSingle();
    if (inst?.institution_type) institutionType = inst.institution_type;
  }

  const usesBatches = BATCH_TYPES.has(institutionType);

  // ── OPS-5 PRECONDITION GUARD ─────────────────────────────────────────────────
  const checks = await Promise.all([
    // Staff: always required
    supabaseAdmin.from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('is_active', true),
    // Academic structure: classes for schools, batches for colleges/coaching
    usesBatches
      ? supabaseAdmin.from('batches')
          .select('id', { count: 'exact', head: true })
          .eq('institution_id', institutionId ?? '00000000-0000-0000-0000-000000000000')
      : supabaseAdmin.from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),
    // Students: always required
    supabaseAdmin.from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('is_active', true),
    // Subjects: required for schools; optional for coaching/higher-ed (they may use course codes instead)
    supabaseAdmin.from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),
  ]);

  const [staffRes, structureRes, studentRes, subjectRes] = checks;
  const missing: string[] = [];

  if ((staffRes.count ?? 0) < 1) missing.push('at_least_one_staff_member');

  if ((structureRes.count ?? 0) < 1) {
    missing.push(usesBatches ? 'at_least_one_batch' : 'at_least_one_class');
  }

  if ((studentRes.count ?? 0) < 1) missing.push('at_least_one_student');

  // Subjects: only required for school types; coaching/higher-ed can activate without subjects
  const isSchoolType = !usesBatches;
  if (isSchoolType && (subjectRes.count ?? 0) < 1) missing.push('at_least_one_subject');

  if (missing.length > 0) {
    return NextResponse.json({
      error: 'onboarding_incomplete',
      message: 'School setup is incomplete. Please complete all required steps before activating.',
      missing,
      institution_type: institutionType,
    }, { status: 400 });
  }

  // ── DPDP GUARD ───────────────────────────────────────────────────────────────
  if (institutionId) {
    const { data: completeRow } = await supabaseAdmin.rpc(
      'institution_legal_acceptance_complete', { p_institution_id: institutionId }
    );
    if (completeRow !== true) {
      const { data: allDocs } = await supabaseAdmin
        .from('legal_documents').select('id, doc_type').eq('is_current', true);
      const { data: ila } = await supabaseAdmin
        .from('institution_legal_acceptances').select('legal_doc_id').eq('institution_id', institutionId);
      const acceptedIds = new Set((ila ?? []).map((a: { legal_doc_id: string }) => a.legal_doc_id));
      const missingDocs = (allDocs ?? [])
        .filter((d: { id: string; doc_type: string }) => !acceptedIds.has(d.id))
        .map((d: { doc_type: string }) => d.doc_type);
      return NextResponse.json({
        error: 'legal_acceptance_required',
        message: 'All legal documents must be accepted before activation.',
        missing_documents: missingDocs,
      }, { status: 400 });
    }
  }

  // ── Activate ──────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { error: sErr } = await supabaseAdmin
    .from('schools').update({ onboarded_at: now }).eq('id', schoolId);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  if (institutionId) {
    await supabaseAdmin.from('institutions').update({ onboarded_at: now }).eq('id', institutionId);
    const isGovt = ['govt_school', 'govt_aided_school', 'welfare_school'].includes(institutionType);
    const isAided = (await supabaseAdmin.from('institutions')
      .select('ownership_type').eq('id', institutionId).maybeSingle())
      .data?.ownership_type === 'aided';
    const isPrivateOrFranchise = !isGovt && !isAided;
    await supabaseAdmin.from('institutions').update({
      feature_flags: {
        fee_module_enabled: isPrivateOrFranchise || isAided,
        meal_tracking_enabled: isGovt,
        rte_mode_enabled: isGovt || isAided,
        scholarship_tracking_enabled: isGovt || isAided,
        online_payment_enabled: false,
      }
    }).eq('id', institutionId);
  }

  return NextResponse.json({
    success: true,
    step: 7,
    redirect: '/dashboard',
    message: 'Your institution is now active.',
    institution_type: institutionType,
  });
}
