// app/api/student/curriculum/route.ts
// P1.4 (#4) — Read-only syllabus/curriculum for the logged-in student.
// Sources curriculum_topics for the student's grade, grouped by subject.
// SELECT-only; no writes.

import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession, studentAuthResponse } from '@/lib/student-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireStudentSession(req); }
  catch (e) { return studentAuthResponse(e); }

  const { schoolId, studentClass } = session;

  // curriculum_topics.grade_level is stored as "Class N" (e.g. "Class 5"),
  // whereas students.class is the bare label (e.g. "5"). Normalise so the two
  // line up. A class with no catalogue (KG / higher-ed labels) simply returns
  // an empty list, which the UI renders as a friendly empty state.
  const gradeLevel = `Class ${String(studentClass ?? '').trim()}`;

  const { data: rows, error } = await supabaseAdmin
    .from('curriculum_topics')
    .select('id, topic, sequence_order, expected_hours, subject_id')
    .eq('school_id', schoolId)
    .eq('grade_level', gradeLevel)
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
  interface GroupOut { subject: string; subject_code: string; topics: TopicOut[] }

  const groupsMap = new Map<string, GroupOut>();
  for (const r of ctRows) {
    const subj = r.subject_id ? subjectMap.get(r.subject_id) : null;
    const name = subj?.name ?? 'General';
    const g = groupsMap.get(name) ?? { subject: name, subject_code: subj?.code ?? '', topics: [] };
    g.topics.push({
      id: r.id,
      topic: r.topic,
      sequence_order: r.sequence_order,
      expected_hours: r.expected_hours ?? null,
    });
    groupsMap.set(name, g);
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => a.subject.localeCompare(b.subject));

  return NextResponse.json({ grade_level: gradeLevel, total: ctRows.length, groups });
}
