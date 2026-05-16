import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// K3: Bulk upsert test scores + auto-calculate rank
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id: testId } = await params;
  const body = await req.json() as { scores: { student_id: string; marks_obtained: number }[] };
  if (!body.scores?.length) return NextResponse.json({ error: 'scores array required' }, { status: 400 });
  // Upsert scores
  const rows = body.scores.map(s => ({
    test_id: testId,
    student_id: s.student_id,
    school_id: schoolId,
    marks_obtained: s.marks_obtained,
  }));
  const { error: upsertErr } = await supabaseAdmin
    .from('test_scores')
    .upsert(rows, { onConflict: 'test_id,student_id' });
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  // Auto-calculate rank using SQL window function
  const { error: rankErr } = await supabaseAdmin.rpc('calculate_test_ranks', { p_test_id: testId });
  // If RPC not available, do it via update (fallback)
  if (rankErr) {
    const { data: scored } = await supabaseAdmin
      .from('test_scores').select('id, marks_obtained')
      .eq('test_id', testId).order('marks_obtained', { ascending: false });
    for (let i = 0; i < (scored ?? []).length; i++) {
      await supabaseAdmin.from('test_scores').update({ rank: i + 1 }).eq('id', scored![i].id);
    }
  }
  return NextResponse.json({ success: true, scores_saved: rows.length });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { id: testId } = await params;
  const { data, error } = await supabaseAdmin
    .from('test_scores')
    .select('id, student_id, marks_obtained, rank, students(name, class, section)')
    .eq('test_id', testId)
    .order('rank', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scores: data ?? [] });
}
