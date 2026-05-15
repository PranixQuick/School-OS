// app/api/admin/onboarding/7-activate/route.ts
// Onboarding Step 7: Review + Activate
// Item #3 DPDP update: GUARD — all legal documents must be accepted before activation.
// Sets institutions.onboarded_at = NOW() on success.
// Returns { success: true, redirect: '/admin' }
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  // Resolve institution_id
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const institutionId = school?.institution_id ?? null;
  // ── DPDP GUARD: legal acceptance must be complete ────────────────────────────
  if (institutionId) {
    const { data: completeRow } = await supabaseAdmin.rpc('institution_legal_acceptance_complete', { p_institution_id: institutionId });
    if (completeRow !== true) {
      // Identify missing doc types for actionable error
      const { data: allDocs } = await supabaseAdmin.from('legal_documents').select('id, doc_type').eq('is_current', true);
      const { data: ila } = await supabaseAdmin.from('institution_legal_acceptances').select('legal_doc_id').eq('institution_id', institutionId);
      const acceptedIds = new Set((ila ?? []).map(a => a.legal_doc_id));
      const missing = (allDocs ?? []).filter(d => !acceptedIds.has(d.id)).map(d => d.doc_type);
      return NextResponse.json({
        error: 'legal_acceptance_required',
        message: 'All legal documents must be accepted before activation.',
        missing_documents: missing,
      }, { status: 400 });
    }
  }
  // ── Activate ──────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { error: sErr } = await supabaseAdmin.from('schools').update({ onboarded_at: now }).eq('id', schoolId);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (institutionId) {
    await supabaseAdmin.from('institutions').update({ onboarded_at: now }).eq('id', institutionId);
    // F2: seed feature_flags from institution_type + ownership_type
    const { data: inst } = await supabaseAdmin.from('institutions')
      .select('institution_type, ownership_type').eq('id', institutionId).maybeSingle();
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
