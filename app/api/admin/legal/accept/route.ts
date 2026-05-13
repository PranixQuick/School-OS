// app/api/admin/legal/accept/route.ts
// Item #3 DPDP Compliance — PR #1
// POST: record institution acceptance of one or more legal documents.
// Immutable: no UPDATE/DELETE on institution_legal_acceptances — UNIQUE constraint enforces one per version.
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, userId } = ctx;
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const docIds = (body as Record<string, unknown>)?.doc_type_ids as unknown[];
  if (!Array.isArray(docIds) || docIds.length === 0) return NextResponse.json({ error: 'doc_type_ids array required' }, { status: 400 });
  if (!docIds.every(isUuid)) return NextResponse.json({ error: 'All doc_type_ids must be valid UUIDs' }, { status: 400 });
  // Resolve institution_id + school_user id
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'School has no institution configured' }, { status: 400 });
  const institutionId = school.institution_id;
  const { data: schoolUser } = await supabaseAdmin.from('school_users').select('id').eq('school_id', schoolId).eq('auth_user_id', userId).maybeSingle();
  if (!schoolUser) return NextResponse.json({ error: 'Requesting user not found in school' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;
  const ua = req.headers.get('user-agent') ?? null;
  let acceptedCount = 0;
  const errors: string[] = [];
  for (const docId of docIds) {
    // Verify doc exists and is current
    const { data: doc } = await supabaseAdmin.from('legal_documents').select('id, doc_type, version').eq('id', docId).eq('is_current', true).maybeSingle();
    if (!doc) { errors.push(`Document ${docId} not found or not current`); continue; }
    const { error: insErr } = await supabaseAdmin.from('institution_legal_acceptances').insert({
      institution_id: institutionId,
      legal_doc_id: doc.id,
      doc_type: doc.doc_type,
      doc_version: doc.version,
      accepted_by: schoolUser.id,
      ip_address: ip,
      user_agent: ua,
      context: 'onboarding',
    });
    // 23505 = unique violation — already accepted (idempotent, not an error)
    if (insErr && !insErr.code?.includes('23505')) {
      errors.push(`Failed to accept ${doc.doc_type}: ${insErr.message}`);
    } else {
      acceptedCount++;
    }
  }
  // Check overall completion
  const { data: completeRow } = await supabaseAdmin.rpc('institution_legal_acceptance_complete', { p_institution_id: institutionId });
  const allComplete = completeRow === true;
  // Fetch missing types if not complete
  let missingTypes: string[] = [];
  if (!allComplete) {
    const { data: allDocs } = await supabaseAdmin.from('legal_documents').select('id, doc_type').eq('is_current', true);
    const { data: ila } = await supabaseAdmin.from('institution_legal_acceptances').select('legal_doc_id').eq('institution_id', institutionId);
    const acceptedDocIds = new Set((ila ?? []).map(a => a.legal_doc_id));
    missingTypes = (allDocs ?? []).filter(d => !acceptedDocIds.has(d.id)).map(d => d.doc_type);
  }
  return NextResponse.json({ accepted_count: acceptedCount, all_complete: allComplete, missing_types: missingTypes, errors });
}
