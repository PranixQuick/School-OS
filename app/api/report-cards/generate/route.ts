import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getActiveApiKey, validateAndTrackApiKey } from '@/lib/apiKey';
import { callClaude } from '@/lib/claudeClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const SCHOOL_NAME = 'Suchitra Academy';
const SCHOOL_TAGLINE = 'CBSE School | Hyderabad';

interface SubjectRecord {
  subject: string;
  marks: number;
  max: number;
  grade: string;
}

async function generateNarrative(
  name: string,
  cls: string,
  section: string,
  subjects: SubjectRecord[]
): Promise<string> {
  const lines = subjects.map(s => `- ${s.subject}: ${s.marks}/${s.max} (${s.grade})`).join('\n');
  const avg = subjects.length
    ? Math.round(subjects.reduce((s, r) => s + r.marks, 0) / subjects.length)
    : 0;

  return callClaude(
    `You are a professional school teacher writing a student progress narrative for a CBSE report card.
Write in a warm, encouraging, professional tone.
Output exactly ONE paragraph between 80 and 120 words.
No bullet points, no headers, no symbols. Plain flowing prose only.
Do not start with the student name directly.`,
    `Student: ${name}\nClass: ${cls}-${section}\nSchool: ${SCHOOL_NAME}\n\nAcademic performance this term:\n${lines}\n\nOverall average: ${avg}%\n\nWrite the teacher narrative comment now.`,
    220
  );
}

function buildReportHTML(params: {
  name: string;
  cls: string;
  section: string;
  admissionNumber: string;
  subjects: SubjectRecord[];
  narrative: string;
  term: string;
}): string {
  const { name, cls, section, admissionNumber, subjects, narrative, term } = params;
  const avg = subjects.length
    ? Math.round(subjects.reduce((s, r) => s + r.marks, 0) / subjects.length)
    : 0;

  const tableRows = subjects
    .map(
      s => `<tr>
      <td>${s.subject}</td>
      <td>${s.marks}</td>
      <td>${s.max}</td>
      <td style="color:${s.grade.startsWith('A') ? '#0F6E56' : s.grade.startsWith('C') ? '#993C1D' : '#854F0B'};font-weight:600">${s.grade}</td>
    </tr>`
    )
    .join('');

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report Card - ${name}</title>
<style>
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; background: #fff; color: #1A1A18; }
  .header { background: #0F6E56; color: #fff; padding: 28px 48px; }
  .header h1 { font-size: 26px; font-weight: 700; }
  .header p { margin-top: 6px; font-size: 13px; color: #9FE1CB; font-family: sans-serif; }
  .student-block { background: #F1EFE8; padding: 18px 48px; border-bottom: 2px solid #D3D1C7; }
  .student-block h2 { font-size: 22px; font-weight: 700; }
  .student-block p { margin-top: 4px; font-size: 13px; color: #5F5E5A; font-family: sans-serif; }
  .content { padding: 32px 48px; }
  .section-label { font-family: sans-serif; font-size: 11px; font-weight: 700; color: #0F6E56; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-family: sans-serif; }
  thead th { background: #0F6E56; color: #fff; padding: 10px 14px; font-size: 12px; text-align: left; }
  tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #E8E6DF; }
  tbody tr:nth-child(even) td { background: #F8F7F4; }
  .avg-row td { background: #E1F5EE !important; font-weight: 700; color: #0F6E56; }
  .narrative-box { background: #FAFAF8; border: 1px solid #D3D1C7; border-radius: 8px; padding: 22px 24px; font-size: 14px; line-height: 1.85; margin-bottom: 40px; }
  .sig-row { display: flex; border-top: 1px solid #E8E6DF; padding-top: 32px; }
  .sig { flex: 1; text-align: center; }
  .sig-name { font-family: sans-serif; font-size: 11px; color: #5F5E5A; margin-top: 8px; }
  .sig-line { border-top: 1px solid #888780; display: block; width: 120px; margin: 0 auto 8px; }
  .footer { background: #F1EFE8; text-align: center; padding: 16px 48px; font-family: sans-serif; font-size: 11px; color: #5F5E5A; margin-top: 20px; }
</style>
</head>
<body>
<div class="header">
  <h1>${SCHOOL_NAME}</h1>
  <p>${SCHOOL_TAGLINE} &nbsp;|&nbsp; Progress Report &mdash; ${term}</p>
</div>
<div class="student-block">
  <h2>${name}</h2>
  <p>Class ${cls}-${section} &nbsp;|&nbsp; Admission No: ${admissionNumber} &nbsp;|&nbsp; Academic Year 2024-25</p>
</div>
<div class="content">
  <p class="section-label">Academic Performance</p>
  <table>
    <thead><tr><th style="width:40%">Subject</th><th>Marks Obtained</th><th>Maximum Marks</th><th>Grade</th></tr></thead>
    <tbody>
      ${tableRows}
      <tr class="avg-row"><td>Average Score</td><td>${avg}%</td><td>100</td><td>-</td></tr>
    </tbody>
  </table>
  <p class="section-label">Teacher Remarks</p>
  <div class="narrative-box">${narrative}</div>
  <div class="sig-row">
    <div class="sig"><span class="sig-line"></span><p class="sig-name">Class Teacher</p></div>
    <div class="sig"><span class="sig-line"></span><p class="sig-name">Principal</p></div>
    <div class="sig"><span class="sig-line"></span><p class="sig-name">Parent / Guardian</p></div>
  </div>
</div>
<div class="footer">
  ${SCHOOL_NAME} &nbsp;|&nbsp; Suchitra Circle, Hyderabad - 500067 &nbsp;|&nbsp; admin@suchitracademy.edu.in &nbsp;|&nbsp; Generated on ${today}
</div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { classNum: string; section: string; term: string };
    const { classNum, section, term } = body;

    if (!classNum || !section || !term) {
      return NextResponse.json({ error: 'classNum, section, term required' }, { status: 400 });
    }

    const apiKey = await getActiveApiKey();
    if (apiKey) await validateAndTrackApiKey(apiKey);

    const { data: students, error: sErr } = await supabaseAdmin
      .from('students')
      .select('id, name, class, section, admission_number')
      .eq('school_id', SCHOOL_ID)
      .eq('class', classNum)
      .eq('section', section)
      .eq('is_active', true)
      .order('roll_number');

    if (sErr || !students?.length) {
      return NextResponse.json({ error: 'No students found for this class' }, { status: 404 });
    }

    const { data: records } = await supabaseAdmin
      .from('academic_records')
      .select('student_id, subject, marks_obtained, max_marks, grade')
      .eq('school_id', SCHOOL_ID)
      .eq('term', term)
      .in('student_id', students.map(s => s.id));

    const recordsByStudent = new Map<string, NonNullable<typeof records>>();
    for (const r of records ?? []) {
      if (!recordsByStudent.has(r.student_id)) recordsByStudent.set(r.student_id, []);
      recordsByStudent.get(r.student_id)!.push(r);
    }

    const reports: { name: string; fileName: string; html: string }[] = [];

    for (const student of students) {
      const raw = recordsByStudent.get(student.id) ?? [];
      const subjects: SubjectRecord[] = raw.map(r => ({
        subject: r.subject,
        marks: Number(r.marks_obtained),
        max: Number(r.max_marks),
        grade: r.grade ?? '-',
      }));

      let narrative = 'The student has demonstrated consistent effort and a positive attitude throughout the term, showing good academic progress across all subjects.';
      try {
        if (subjects.length) {
          narrative = await generateNarrative(student.name, student.class, student.section, subjects);
        }
      } catch (e) {
        console.error(`Claude error for ${student.name}:`, e);
      }

      await supabaseAdmin.from('report_narratives').upsert(
        {
          school_id: SCHOOL_ID,
          student_id: student.id,
          term,
          narrative_text: narrative,
          status: 'draft',
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,term' }
      );

      reports.push({
        name: student.name,
        fileName: `${student.name.replace(/\s+/g, '_')}_Class${student.class}${student.section}_Report.html`,
        html: buildReportHTML({
          name: student.name,
          cls: student.class,
          section: student.section,
          admissionNumber: student.admission_number ?? '-',
          subjects,
          narrative,
          term,
        }),
      });
    }

    return NextResponse.json({ success: true, count: reports.length, term, reports });
  } catch (err) {
    console.error('Report card error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
