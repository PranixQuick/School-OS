// app/api/teacher/classes/route.ts
// Item #1 Track C Phase 4 — list teacher's classes + subjects (for UI dropdowns).
//
// GET /api/teacher/classes — returns the distinct (class_id, subject_id) tuples
// the teacher is scheduled to teach (derived from timetable).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireTeacherSession(req); }
  catch (e) {
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { staffId, schoolId } = ctx;

  // Pull tuples from timetable for this teacher
  const { data: tt, error: ttErr } = await supabaseAdmin
    .from('timetable')
    .select('class_id, subject_id')
    .eq('staff_id', staffId)
    .eq('school_id', schoolId);
  if (ttErr) return NextResponse.json({ error: ttErr.message }, { status: 500 });

  // De-dup
  const seen = new Set<string>();
  const tuples: Array<{ class_id: string; subject_id: string }> = [];
  for (const row of tt ?? []) {
    const key = row.class_id + ':' + row.subject_id;
    if (!seen.has(key)) { seen.add(key); tuples.push(row); }
  }

  if (tuples.length === 0) {
    return NextResponse.json({ classes: [], subjects: [] });
  }

  const classIds = Array.from(new Set(tuples.map((t) => t.class_id)));
  const subjectIds = Array.from(new Set(tuples.map((t) => t.subject_id)));

  const [classRes, subjectRes] = await Promise.all([
    supabaseAdmin
      .from('classes')
      .select('id, grade_level, section')
      .in('id', classIds)
      .eq('school_id', schoolId),
    supabaseAdmin
      .from('subjects')
      .select('id, code, name')
      .in('id', subjectIds)
      .eq('school_id', schoolId),
  ]);

  const classes = (classRes.data ?? []).map((c) => ({
    id: c.id,
    label: 'Grade ' + c.grade_level + (c.section ? '-' + c.section : ''),
  }));
  const subjects = (subjectRes.data ?? []).map((s) => ({
    id: s.id,
    label: s.name + (s.code ? ' (' + s.code + ')' : ''),
  }));

  return NextResponse.json({ classes, subjects });
}
