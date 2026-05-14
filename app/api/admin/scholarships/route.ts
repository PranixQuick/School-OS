// app/api/admin/scholarships/route.ts
// Batch 4A — Scholarship listing and creation.
// Guard: feature_flags.scholarship_tracking_enabled
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function checkScholarshipEnabled(schoolId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('schools').select('institutions(feature_flags)').eq('id', schoolId).maybeSingle();
  const inst = data ? (Array.isArray(data.institutions) ? data.institutions[0] : data.institutions) as { feature_flags?: Record<string, unknown> } | null : null;
  return !!(inst?.feature_flags?.scholarship_tracking_enabled);
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  if (!(await checkScholarshipEnabled(schoolId))) {
    return NextResponse.json({ error: 'Scholarship tracking is not enabled for this institution' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') ?? 'all';

  let query = supabaseAdmin
    .from('scholarships')
    .select('id, student_id, scholarship_name, provider, amount, status, applied_at, approved_at, expiry_date, notes, students(name, class, section)')
    .eq('school_id', schoolId)
    .order('applied_at', { ascending: false });

  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const scholarships = (data ?? []).map(s => {
    const st = Array.isArray(s.students) ? s.students[0] as { name: string; class: string; section: string } | undefined : s.students as { name: string; class: string; section: string } | null;
    return { ...s, students: undefined, student_name: st?.name ?? '—', student_class: st?.class, student_section: st?.section };
  });

  return NextResponse.json({ scholarships, count: scholarships.length });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  if (!(await checkScholarshipEnabled(schoolId))) {
    return NextResponse.json({ error: 'Scholarship tracking is not enabled for this institution' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { student_id, scholarship_name, provider, amount, academic_year_id, expiry_date, notes, status } = body as {
    student_id?: string; scholarship_name?: string; provider?: string; amount?: number;
    academic_year_id?: string; expiry_date?: string; notes?: string; status?: string;
  };
  if (!student_id || !scholarship_name || !provider) {
    return NextResponse.json({ error: 'student_id, scholarship_name, and provider are required' }, { status: 400 });
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('scholarships')
    .insert({ school_id: schoolId, student_id, scholarship_name, provider, amount: amount ?? null, academic_year_id: academic_year_id ?? null, expiry_date: expiry_date ?? null, notes: notes ?? null, status: status ?? 'applied' })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ scholarship: inserted }, { status: 201 });
}
