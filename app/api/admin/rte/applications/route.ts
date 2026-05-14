// app/api/admin/rte/applications/route.ts
// Batch 4B — RTE application listing and creation.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function checkRteEnabled(schoolId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('schools').select('institutions(feature_flags)').eq('id', schoolId).maybeSingle();
  const inst = data ? (Array.isArray(data.institutions) ? data.institutions[0] : data.institutions) as { feature_flags?: Record<string, unknown> } | null : null;
  return !!(inst?.feature_flags?.rte_mode_enabled);
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  if (!(await checkRteEnabled(schoolId))) {
    return NextResponse.json({ error: 'RTE mode is not enabled for this institution' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') ?? 'all';
  const yearId = searchParams.get('year');

  let query = supabaseAdmin
    .from('rte_applications')
    .select('*')
    .eq('school_id', schoolId)
    .order('lottery_number', { ascending: true, nullsFirst: false })
    .order('applied_at', { ascending: true });

  if (statusFilter !== 'all') query = query.eq('status', statusFilter);
  if (yearId) query = query.eq('academic_year_id', yearId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data ?? [], count: data?.length ?? 0 });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  if (!(await checkRteEnabled(schoolId))) {
    return NextResponse.json({ error: 'RTE mode is not enabled for this institution' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { applicant_name, parent_name, parent_phone, date_of_birth, category, address, aadhaar_number, supporting_docs, academic_year_id } = body as {
    applicant_name?: string; parent_name?: string; parent_phone?: string; date_of_birth?: string;
    category?: string; address?: string; aadhaar_number?: string; supporting_docs?: string; academic_year_id?: string;
  };
  if (!applicant_name || !parent_name || !parent_phone || !date_of_birth || !category) {
    return NextResponse.json({ error: 'applicant_name, parent_name, parent_phone, date_of_birth, category required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rte_applications')
    .insert({ school_id: schoolId, applicant_name, parent_name, parent_phone, date_of_birth, category, address: address ?? null, aadhaar_number: aadhaar_number ?? null, supporting_docs: supporting_docs ?? null, academic_year_id: academic_year_id ?? null, status: 'applied' })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data }, { status: 201 });
}
