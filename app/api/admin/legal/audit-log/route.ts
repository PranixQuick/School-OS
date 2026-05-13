// app/api/admin/legal/audit-log/route.ts
// Item #3 DPDP Compliance — PR #1
// GET: immutable acceptance audit log for this institution.
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
  if (!school?.institution_id) return NextResponse.json({ audit_log: [], institution_id: null });
  const institutionId = school.institution_id;
  const { data, error } = await supabaseAdmin
    .from('institution_legal_acceptances')
    .select('id, doc_type, doc_version, accepted_at, context, ip_address, school_users:accepted_by(email, name)')
    .eq('institution_id', institutionId)
    .order('accepted_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ audit_log: data ?? [], institution_id: institutionId });
}
