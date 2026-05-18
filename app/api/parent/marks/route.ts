import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('academic_records')
    .select('id, subject, exam_type, marks_obtained, max_marks, grade, grade_points, exam_date, term, teacher_remarks')
    .eq('school_id', session.schoolId)
    .eq('student_id', session.studentId)
    .order('exam_date', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    marks: (data ?? []).map(r => ({
      id: r.id,
      subject: r.subject,
      exam_name: r.exam_type ?? r.term ?? 'Exam',
      marks_obtained: r.marks_obtained,
      max_marks: r.max_marks,
      grade: r.grade,
      grade_points: r.grade_points,
      exam_date: r.exam_date,
      remarks: r.teacher_remarks,
    }))
  });
}
