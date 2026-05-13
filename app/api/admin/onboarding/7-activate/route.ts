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
  }
  return NextResponse.json({ success: true, step: 7, redirect: '/admin', message: 'School is now active.' });
}
