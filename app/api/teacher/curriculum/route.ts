// app/api/teacher/curriculum/route.ts
// P1.4 (#4) — Read-only curriculum reference for teachers.
// Returns the school's curriculum_topics grouped by grade -> subject.
// SELECT-only; no writes. School-wide reference (see note below).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireTeacherSession(req); }
  catch (e) {
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  // School-wide curriculum catalogue. Not scoped to the teacher's timetable
  // because that mapping is currently too sparse to scope reliably; teachers
  // reference the full curriculum. Scoping to taught grades is a future
  // refinement once the timetable is populated.
  const { data: rows, error } = await supabaseAdmin
    .from('curriculum_topics')
    .select('id, topic, grade_level, sequence_order, expected_hours, subject_id')
    .eq('school_id', schoolId)
    .order('sequence_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ctRows = rows ?? [];

  // Hydrate subject names via a separate lookup (matches the parent
  // lesson-plans pattern; avoids relying on a PostgREST FK embed).
  const subjectIds = Array.from(new Set(ctRows.map(r => r.subject_id).filter(Boolean)));
  let subjectMap = new Map<string, { id: string; name: string; code: string }>();
  if (subjectIds.length > 0) {
    const { data: subjects } = await supabaseAdmin
      .from('subjects')
      .select('id, name, code')
      .in('id', subjectIds);
    subjectMap = new Map((subjects ?? []).map(s => [s.id, s]));
  }

  interface TopicOut { id: string; topic: string; sequence_order: number; expected_hours: number | null }

  // grade_level -> subject name -> topics
  const gradeMap = new Map<string, Map<string, TopicOut[]>>();
  for (const r of ctRows) {
    const grade = r.grade_level ?? 'Other';
    const subj = r.subject_id ? subjectMap.get(r.subject_id) : null;
    const subjectName = subj?.name ?? 'General';
    const sm = gradeMap.get(grade) ?? new Map<string, TopicOut[]>();
    const arr = sm.get(subjectName) ?? [];
    arr.push({ id: r.id, topic: r.topic, sequence_order: r.sequence_order, expected_hours: r.expected_hours ?? null });
    sm.set(subjectName, arr);
    gradeMap.set(grade, sm);
  }

  const gradeNum = (g: string): number => {
    const m = g.match(/\d+/);
    return m ? parseInt(m[0], 10) : 9999;
  };

  const grades = Array.from(gradeMap.entries())
    .map(([grade_level, sm]) => ({
      grade_level,
      groups: Array.from(sm.entries())
        .map(([subject, topics]) => ({ subject, topics }))
        .sort((a, b) => a.subject.localeCompare(b.subject)),
    }))
    .sort((a, b) => gradeNum(a.grade_level) - gradeNum(b.grade_level));

  return NextResponse.json({ total: ctRows.length, grades });
}
