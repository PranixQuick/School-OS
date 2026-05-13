// app/api/teacher/marks/route.ts
// Batch 6 — Marks entry and retrieval for teachers.
// Uses academic_records table (confirmed schema-first):
//   UNIQUE(school_id, student_id, subject, term)
//   subject column is TEXT (store name, not UUID)
//   exam_type maps to directive's assessment_type
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// ── GET: ?grade_level=5&section=A&subject=Mathematics&term=term_1 ─────────────
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireTeacherSession(req); }
  catch (e) {
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;
  const p = req.nextUrl.searchParams;
  const gradeLevel = p.get('grade_level');
  const section = p.get('section');
  const subject = p.get('subject');
  const term = p.get('term');

  if (!term) return NextResponse.json({ error: 'term is required' }, { status: 400 });

  // Get students in this class
  let studentIds: string[] = [];
  if (gradeLevel && section) {
    const { data: classRow } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('school_id', schoolId)
      .eq('grade_level', gradeLevel)
      .eq('section', section)
      .maybeSingle();
    if (classRow) {
      const { data: sts } = await supabaseAdmin
        .from('students')
        .select('id, name, roll_number')
        .eq('school_id', schoolId)
        .eq('class_id', classRow.id)
        .eq('is_active', true)
        .order('name');
      studentIds = (sts ?? []).map(s => s.id);

      // Fetch marks for these students
      let marksQuery = supabaseAdmin
        .from('academic_records')
        .select('student_id, subject, marks_obtained, max_marks, grade, exam_type, exam_date, teacher_remarks')
        .eq('school_id', schoolId)
        .eq('term', term)
        .in('student_id', studentIds);
      if (subject) marksQuery = marksQuery.eq('subject', subject);
      const { data: marks } = await marksQuery;

      const marksMap = new Map((marks ?? []).map(m => [`${m.student_id}:${m.subject}`, m]));

      const roster = (sts ?? []).map(s => ({
        student_id: s.id,
        student_name: s.name,
        roll_number: s.roll_number,
        marks: subject
          ? marksMap.get(`${s.id}:${subject}`) ?? null
          : (marks ?? []).filter(m => m.student_id === s.id),
      }));
      return NextResponse.json({ roster, term, subject: subject ?? null });
    }
  }

  // Fallback: return all marks for term
  let q = supabaseAdmin
    .from('academic_records')
    .select('id, student_id, subject, marks_obtained, max_marks, grade, exam_type, exam_date')
    .eq('school_id', schoolId)
    .eq('term', term);
  if (subject) q = q.eq('subject', subject);
  const { data } = await q.order('subject');
  return NextResponse.json({ marks: data ?? [], term });
}

// ── POST: upsert marks for a student ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireTeacherSession(req); }
  catch (e) {
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { student_id, subject, term, marks_obtained, max_marks, exam_type, exam_date, teacher_remarks } = body as {
    student_id?: string; subject?: string; term?: string;
    marks_obtained?: number; max_marks?: number;
    exam_type?: string; exam_date?: string; teacher_remarks?: string;
  };

  if (!student_id || !subject || !term) return NextResponse.json({ error: 'student_id, subject, term required' }, { status: 400 });
  if (marks_obtained === undefined || max_marks === undefined) return NextResponse.json({ error: 'marks_obtained and max_marks required' }, { status: 400 });
  if (marks_obtained < 0 || max_marks <= 0) return NextResponse.json({ error: 'marks must be positive' }, { status: 400 });
  if (marks_obtained > max_marks) return NextResponse.json({ error: 'marks_obtained cannot exceed max_marks' }, { status: 400 });

  // Verify student belongs to this school
  const { data: student } = await supabaseAdmin.from('students').select('id').eq('id', student_id).eq('school_id', schoolId).maybeSingle();
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  // Auto-calculate grade
  const pct = (marks_obtained / max_marks) * 100;
  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F';

  // Upsert — UNIQUE(school_id, student_id, subject, term)
  const { data: record, error } = await supabaseAdmin
    .from('academic_records')
    .upsert({
      school_id: schoolId,
      student_id,
      subject,                           // text column
      term,
      marks_obtained,
      max_marks,
      grade,
      exam_type: exam_type ?? 'unit_test_1',
      exam_date: exam_date ?? new Date().toISOString().slice(0, 10),
      teacher_remarks: teacher_remarks ?? null,
      data_source: 'teacher_entry',
    }, { onConflict: 'school_id,student_id,subject,term' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record }, { status: 201 });
}
