// app/api/admin/legal/documents/route.ts
// Item #3 DPDP Compliance — PR #1
// GET: returns all current legal documents with acceptance status for this institution.
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
  // Resolve institution_id via schools table
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const institutionId = school?.institution_id ?? null;
  // Fetch all current legal docs with acceptance status
  const { data: docs, error } = await supabaseAdmin
    .from('legal_documents')
    .select('id, doc_type, version, title, content_url, effective_at')
    .eq('is_current', true)
    .order('doc_type');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Fetch acceptances for this institution
  let acceptances: Record<string, { accepted_at: string; accepted_by: string; context: string }> = {};
  if (institutionId) {
    const { data: ila } = await supabaseAdmin
      .from('institution_legal_acceptances')
      .select('legal_doc_id, accepted_at, accepted_by, context')
      .eq('institution_id', institutionId);
    for (const a of ila ?? []) {
      acceptances[a.legal_doc_id] = { accepted_at: a.accepted_at, accepted_by: a.accepted_by, context: a.context };
    }
  }
  const documents = (docs ?? []).map(d => ({
    ...d,
    accepted: !!acceptances[d.id],
    accepted_at: acceptances[d.id]?.accepted_at ?? null,
    accepted_by: acceptances[d.id]?.accepted_by ?? null,
    context: acceptances[d.id]?.context ?? null,
  }));
  const allAccepted = documents.every(d => d.accepted);
  return NextResponse.json({ documents, all_accepted: allAccepted, institution_id: institutionId });
}
