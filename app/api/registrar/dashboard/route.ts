// app/api/registrar/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sid = session.schoolId;
  const today = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

  const [examsRes, studRes] = await Promise.allSettled([
    supabaseAdmin.from('examination_schedule').select('*').eq('school_id', sid).order('start_date').limit(50),
    supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', sid).eq('is_active', true),
  ]);

  const allExams  = examsRes.status === 'fulfilled' ? (examsRes.value.data ?? []) : [];
  const studCount = studRes.status === 'fulfilled' ? (studRes.value.count ?? 0) : 0;

  const upcoming = allExams.filter(e => e.start_date > today && e.status === 'scheduled');
  const ongoing  = allExams.filter(e => e.status === 'ongoing');
  const pendingResults = allExams.filter(e => e.status === 'completed');

  return NextResponse.json({
    upcoming_exams: upcoming,
    ongoing_exams: ongoing,
    pending_results: pendingResults,
    total_enrolled: studCount,
    certificates_pending: 0,
    revaluation_pending: 0,
    academic_year: `${year}-${String(year+1).slice(2)}`,
  });
}
