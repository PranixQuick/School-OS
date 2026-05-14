// app/api/student/attendance/route.ts
// Batch 4D — Student attendance view.

import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession, studentAuthResponse } from '@/lib/student-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireStudentSession(req); }
  catch (e) { return studentAuthResponse(e); }

  const { studentId, schoolId } = session;
  const { searchParams } = new URL(req.url);
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
  const from = searchParams.get('from') ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('date, status')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const records = data ?? [];
  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  const total = records.length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return NextResponse.json({
    attendance: records,
    summary: { present, absent, late, total, percentage },
    from, to,
  });
}
