// app/api/parent/report-cards/route.ts
// Parent view of child marks grouped by term.
// Auth: getParentSession cookie (same pattern as /api/parent/fees).
// Backward compat: falls back to phone+PIN body auth if no session cookie.
// academic_records.subject is TEXT (not UUID) — confirmed in Batch 6.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

function calcGrade(pct: number): string {
  if (pct >= 90) return 'A+'; if (pct >= 80) return 'A'; if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B'; if (pct >= 50) return 'C'; if (pct >= 40) return 'D';
  return 'F';
}

async function resolveParent(req: NextRequest): Promise<{ schoolId: string; studentId: string } | null> {
  // Cookie-first
  const session = await getParentSession(req);
  if (session) return { schoolId: session.schoolId, studentId: session.studentId };

  // Fallback: phone+PIN body (backward compat)
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

async function handleRequest(req: NextRequest) {
  const parent = await resolveParent(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const term = req.nextUrl.searchParams.get('term') ?? undefined;

  // Fetch student info
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('name, class, section, roll_number')
    .eq('id', parent.studentId)
    .eq('school_id', parent.schoolId)
    .maybeSingle();

  // Fetch marks
  let query = supabaseAdmin
    .from('academic_records')
    .select('term, subject, marks_obtained, max_marks, grade, exam_date')
    .eq('school_id', parent.schoolId)
    .eq('student_id', parent.studentId)
    .order('term')
    .order('subject');
  if (term) query = query.eq('term', term);
  const { data: marks } = await query;

  // Group by term
  const termMap = new Map<string, { subject: string; marks_obtained: number; max_marks: number; grade: string }[]>();
  for (const m of marks ?? []) {
    const arr = termMap.get(m.term) ?? [];
    arr.push({ subject: m.subject, marks_obtained: Number(m.marks_obtained), max_marks: Number(m.max_marks), grade: m.grade ?? '' });
    termMap.set(m.term, arr);
  }

  const terms = [...termMap.entries()].map(([t, subjects]) => {
    const totalObt = subjects.reduce((s, r) => s + r.marks_obtained, 0);
    const totalMax = subjects.reduce((s, r) => s + r.max_marks, 0);
    const pct = totalMax > 0 ? parseFloat(((totalObt / totalMax) * 100).toFixed(1)) : 0;
    return { term: t, subjects, total_obtained: totalObt, total_max: totalMax, percentage: pct, overall_grade: calcGrade(pct) };
  });

  return NextResponse.json({
    student: { name: student?.name ?? 'N/A', class: student?.class ?? '?', section: student?.section ?? '', roll_number: student?.roll_number ?? null },
    terms,
  });
}

export async function GET(req: NextRequest) { return handleRequest(req); }
export async function POST(req: NextRequest) { return handleRequest(req); }
