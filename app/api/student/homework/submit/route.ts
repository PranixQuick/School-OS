import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStudentSession } from '@/lib/student-auth';

// G2: Student homework submission endpoint
export async function POST(req: NextRequest) {
  const ctx = await requireStudentSession(req);
  if (!ctx) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { studentId, schoolId } = ctx;

  const body = await req.json() as { homework_id?: string; notes?: string };
  if (!body.homework_id) return NextResponse.json({ error: 'homework_id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('homework_submissions')
    .upsert({
      school_id: schoolId,
      student_id: studentId,
      homework_id: body.homework_id,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      notes: body.notes ?? null,
    }, {
      onConflict: 'student_id,homework_id',
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
