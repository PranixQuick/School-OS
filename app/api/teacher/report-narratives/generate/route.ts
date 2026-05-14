// app/api/teacher/report-narratives/generate/route.ts
// Batch 13 — AI narrative generation for report cards.
// report_narratives: id, school_id, student_id, term, narrative_text,
//   status (draft/approved/rejected), generated_at, approved_by, approved_at,
//   teacher_id (added), principal_notes (added)
// attendance_records does NOT exist — skip attendance data.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireTeacherSession(req); }
  catch (e) { if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { student_id, term, teacher_notes } = body as { student_id?: string; term?: string; teacher_notes?: string };
  if (!student_id || !term) return NextResponse.json({ error: 'student_id and term are required' }, { status: 400 });

  // Guard: check existing narrative
  const { data: existing } = await supabaseAdmin
    .from('report_narratives')
    .select('id, status')
    .eq('school_id', schoolId).eq('student_id', student_id).eq('term', term)
    .maybeSingle();

  if (existing && (existing.status === 'approved')) {
    return NextResponse.json({ error: 'already_approved', message: 'Narrative already approved — contact principal to reset' }, { status: 409 });
  }

  // Fetch student + marks
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('name, class, section')
    .eq('id', student_id).eq('school_id', schoolId).maybeSingle();
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const { data: marks } = await supabaseAdmin
    .from('academic_records')
    .select('subject, marks_obtained, max_marks')
    .eq('student_id', student_id).eq('school_id', schoolId).eq('term', term);

  // Calculate overall performance
  const marksRows = marks ?? [];
  const totalObtained = marksRows.reduce((sum, m) => sum + Number(m.marks_obtained ?? 0), 0);
  const totalMax = marksRows.reduce((sum, m) => sum + Number(m.max_marks ?? 100), 0);
  const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
  const subjectSummary = marksRows.length > 0
    ? marksRows.map(m => `${m.subject}: ${m.marks_obtained}/${m.max_marks}`).join(', ')
    : 'No marks recorded';

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });

  // Generate narrative via Anthropic API
  const prompt = `Generate a brief, encouraging academic narrative comment for a student's report card. Keep it to 3-4 sentences. Professional, warm tone, suitable for Indian school context.

Student: ${student.name}, Class ${student.class ?? '?'}-${student.section ?? ''}, Term: ${term}
Overall performance: ${percentage}% (${subjectSummary})${teacher_notes ? `\nTeacher notes: ${teacher_notes}` : ''}

Avoid generic phrases. Be specific to the performance data. Do not start with "The student".`;

  let narrativeText = '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json() as { content?: { type: string; text: string }[]; error?: { message: string } };
    if (!res.ok || !data.content) throw new Error(data.error?.message ?? `API error ${res.status}`);
    narrativeText = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (e) {
    return NextResponse.json({ error: `AI generation failed: ${String(e)}` }, { status: 502 });
  }

  // Upsert narrative
  const upsertData = {
    school_id: schoolId,
    student_id,
    term,
    narrative_text: narrativeText,
    status: 'draft',
    generated_at: new Date().toISOString(),
    teacher_id: staffId ?? null,
  };

  let narrativeId: string;
  if (existing) {
    const { data: updated } = await supabaseAdmin
      .from('report_narratives')
      .update({ narrative_text: narrativeText, status: 'draft', generated_at: upsertData.generated_at, teacher_id: upsertData.teacher_id })
      .eq('id', existing.id)
      .select('id').single();
    narrativeId = updated?.id ?? existing.id;
  } else {
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('report_narratives').insert(upsertData).select('id').single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    narrativeId = inserted!.id;
  }

  return NextResponse.json({ narrative_id: narrativeId, narrative_text: narrativeText, student_name: student.name, term }, { status: existing ? 200 : 201 });
}
