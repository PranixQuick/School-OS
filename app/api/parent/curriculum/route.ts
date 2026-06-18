// app/api/parent/curriculum/route.ts
// P1.4 (#4) — Read-only syllabus/curriculum for a parent's child.
// Lists curriculum_topics for the child's grade, grouped by subject.
// SELECT-only; no writes.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

async function resolveParent(req: NextRequest) {
  // Cookie-based session first (current UI).
  const session = await getParentSession(req);
  if (session) return { schoolId: session.schoolId, studentId: session.studentId };

  // Fallback: phone+PIN in body (legacy).
  let body: { phone?: string; pin?: string } = {};
  try { body = await req.json(); } catch { return null; }
  const { phone, pin } = body;
  if (!phone || !pin) return null;

  const { data: parents } = await supabaseAdmin.from('parents')
    .select('id, school_id, student_id, access_pin, access_pin_hashed')
    .eq('phone', phone);
  if (!parents || parents.length !== 1) return null;
  const p = parents[0];

  let valid = false;
  if (p.access_pin_hashed) valid = await bcrypt.compare(pin, p.access_pin_hashed);
  else if (p.access_pin) valid = p.access_pin === pin;
  if (!valid) return null;

  return { schoolId: p.school_id, studentId: p.student_id };
}

export async function GET(req: NextRequest) {
  const parent = await resolveParent(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve the child's grade label.
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('class')
    .eq('id', parent.studentId)
    .eq('school_id', parent.schoolId)
    .maybeSingle();

  if (!student) return NextResponse.json({ grade_level: '', total: 0, groups: [] });

  // curriculum_topics.grade_level is stored as "Class N" (e.g. "Class 5"),
  // whereas students.class is the bare label (e.g. "5"). Normalise so they
  // line up. A class with no catalogue (KG / higher-ed labels) returns an
  // empty list, which the UI renders as a friendly empty state.
  const gradeLevel = `Class ${String(student.class ?? '').trim()}`;

  const { data: rows, error } = await supabaseAdmin
    .from('curriculum_topics')
    .select('id, topic, sequence_order, expected_hours, subject_id')
    .eq('school_id', parent.schoolId)
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

export async function POST(req: NextRequest) {
  return GET(req);
}
