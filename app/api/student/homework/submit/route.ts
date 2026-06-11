import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStudentSession } from '@/lib/student-auth';
import { writeNotification } from '@/lib/notifications';

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

  // Notify the assigning teacher in real time that a submission arrived.
  // Best-effort — the submission is already committed.
  try {
    const { data: hw } = await supabaseAdmin
      .from('homework')
      .select('title, assigned_by')
      .eq('id', body.homework_id)
      .eq('school_id', schoolId)
      .maybeSingle();
    const { data: stu } = await supabaseAdmin
      .from('students')
      .select('name')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle();
    const studentName = stu?.name ?? 'A student';
    const hwTitle = hw?.title ?? 'homework';
    const notifResult = await writeNotification(supabaseAdmin, {
      school_id: schoolId,
      type: 'homework_assigned',
      title: 'Homework submission received',
      message: `${studentName} submitted "${hwTitle}". Review in Teacher → Homework → Submissions.`,
      module: 'homework_submission',
      reference_id: body.homework_id,
    });
    if (!notifResult.ok) console.error('Submission notification failed (non-fatal):', notifResult.error);
  } catch (notifErr) {
    console.error('Submission notification threw (non-fatal):', notifErr);
  }

  return NextResponse.json({ success: true });
}
