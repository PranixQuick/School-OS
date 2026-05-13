// app/api/admin/legal/acceptance-status/route.ts
// Item #3 DPDP Compliance — PR #1
// GET: summary of acceptance status for this institution.
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'School has no institution configured' }, { status: 400 });
  const institutionId = school.institution_id;
  const { data: completeRow } = await supabaseAdmin.rpc('institution_legal_acceptance_complete', { p_institution_id: institutionId });
  const allAccepted = completeRow === true;
  // Accepted docs with email of acceptor
  const { data: accepted } = await supabaseAdmin
    .from('institution_legal_acceptances')
    .select('doc_type, doc_version, accepted_at, school_users:accepted_by(email)')
    .eq('institution_id', institutionId)
    .order('accepted_at', { ascending: true });
  // Pending docs
  const { data: allDocs } = await supabaseAdmin.from('legal_documents').select('id, doc_type, version, title, content_url').eq('is_current', true);
  const { data: ila } = await supabaseAdmin.from('institution_legal_acceptances').select('legal_doc_id').eq('institution_id', institutionId);
  const acceptedDocIds = new Set((ila ?? []).map(a => a.legal_doc_id));
  const pending = (allDocs ?? []).filter(d => !acceptedDocIds.has(d.id));
  return NextResponse.json({
    all_accepted: allAccepted,
    accepted: (accepted ?? []).map(a => ({
      doc_type: a.doc_type,
      version: a.doc_version,
      accepted_at: a.accepted_at,
      accepted_by_email: (a.school_users as {email?:string}|null)?.email ?? null,
    })),
    pending: pending.map(d => ({ doc_type: d.doc_type, version: d.version, title: d.title, content_url: d.content_url })),
  });
}
