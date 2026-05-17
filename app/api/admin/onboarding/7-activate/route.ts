// app/api/admin/onboarding/7-activate/route.ts
// OPS-5: Server-side preconditions — cannot activate with 0 staff, 0 classes, 0 subjects, 0 students
// DPDP GUARD: all legal documents must be accepted before activation.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

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

  // ── OPS-5 PRECONDITION GUARD ─────────────────────────────────────────────────
  const [staffRes, classRes, studentRes, subjectRes] = await Promise.all([
    supabaseAdmin.from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('is_active', true),
    supabaseAdmin.from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),
    supabaseAdmin.from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('is_active', true),
    supabaseAdmin.from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId),
  ]);

  const missing: string[] = [];
  if ((staffRes.count ?? 0) < 1) missing.push('at_least_one_staff_member');
  if ((classRes.count ?? 0) < 1) missing.push('at_least_one_class');
  if ((studentRes.count ?? 0) < 1) missing.push('at_least_one_student');
  if ((subjectRes.count ?? 0) < 1) missing.push('at_least_one_subject');

  if (missing.length > 0) {
    return NextResponse.json({
      error: 'onboarding_incomplete',
      message: 'School setup is incomplete. Please complete required steps before activating.',
      missing,
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
    const { data: inst } = await supabaseAdmin
      .from('institutions').select('institution_type, ownership_type')
      .eq('id', institutionId).maybeSingle();
    const isGovt = ['govt_school','govt_aided_school','welfare_school'].includes(inst?.institution_type ?? '');
    const isPrivateOrFranchise = ['private','franchise'].includes(inst?.ownership_type ?? '');
    const isAided = inst?.ownership_type === 'aided';
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

  return NextResponse.json({ success: true, step: 7, redirect: '/dashboard', message: 'School is now active.' });
}
