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

interface AcademicRow {
  student_id: string;
  subject: string;
  marks_obtained: number;
  max_marks: number;
  grade: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  class: string;
  section: string;
  admission_number: string | null;
}

async function generateNarrative(
  name: string,
  cls: string,
  section: string,
  subjects: SubjectRecord[]
): Promise<string> {
  const lines = subjects.map(s => `- ${s.subject}: ${s.marks}/${s.max} (${s.grade})`).join('\n');
  const avg = subjects.length
    ? Math.round(subjects.reduce((sum, r) => sum + r.marks, 0) / subjects.length)
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

function buildReportHTML(
  name: string,
  cls: string,
  section: string,
  admissionNumber: string,
  subjects: SubjectRecord[],
  narrative: string,
  term: string
): string {
  const avg = subjects.length
    ? Math.round(subjects.reduce((sum, r) => sum + r.marks, 0) / subjects.length)
    : 0;

  const rows = subjects.map(s => {
    const gradeColor = s.grade.startsWith('A') ? '#0F6E56' : s.grade.startsWith('C') ? '#993C1D' : '#854F0B';
    return `<tr><td>${s.subject}</td><td>${s.marks}</td><td>${s.max}</td><td style="color:${gradeColor};font-weight:600">${s.grade}</td></tr>`;
  }).join('');

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report Card - ${name}</title>
<style>
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Georgia,serif;background:#fff;color:#1A1A18;}
.hdr{background:#0F6E56;color:#fff;padding:28px 48px;}
.hdr h1{font-size:26px;font-weight:700;}
.hdr p{margin-top:6px;font-size:13px;color:#9FE1CB;font-family:sans-serif;}
.stu{background:#F1EFE8;padding:18px 48px;border-bottom:2px solid #D3D1C7;}
.stu h2{font-size:22px;font-weight:700;}
.stu p{margin-top:4px;font-size:13px;color:#5F5E5A;font-family:sans-serif;}
.body{padding:32px 48px;}
.lbl{font-family:sans-serif;font-size:11px;font-weight:700;color:#0F6E56;letter-spacing:.07em;text-transform:uppercase;margin-bottom:12px;}
table{width:100%;border-collapse:collapse;margin-bottom:32px;font-family:sans-serif;}
thead th{background:#0F6E56;color:#fff;padding:10px 14px;font-size:12px;text-align:left;}
tbody td{padding:10px 14px;font-size:13px;border-bottom:1px solid #E8E6DF;}
tbody tr:nth-child(even) td{background:#F8F7F4;}
.avg td{background:#E1F5EE!important;font-weight:700;color:#0F6E56;}
.narr{background:#FAFAF8;border:1px solid #D3D1C7;border-radius:8px;padding:22px 24px;font-size:14px;line-height:1.85;margin-bottom:40px;}
.sigs{display:flex;border-top:1px solid #E8E6DF;padding-top:32px;}
.sig{flex:1;text-align:center;}
.sig-line{border-top:1px solid #888780;display:block;width:120px;margin:0 auto 8px;}
.sig-name{font-family:sans-serif;font-size:11px;color:#5F5E5A;}
.ftr{background:#F1EFE8;text-align:center;padding:16px 48px;font-family:sans-serif;font-size:11px;color:#5F5E5A;margin-top:20px;}
</style>
</head>
<body>
<div class="hdr"><h1>${SCHOOL_NAME}</h1><p>${SCHOOL_TAGLINE} &nbsp;|&nbsp; Progress Report &mdash; ${term}</p></div>
<div class="stu"><h2>${name}</h2><p>Class ${cls}-${section} &nbsp;|&nbsp; Admission No: ${admissionNumber} &nbsp;|&nbsp; Academic Year 2024-25</p></div>
<div class="body">
<p class="lbl">Academic Performance</p>
<table>
<thead><tr><th style="width:40%">Subject</th><th>Marks Obtained</th><th>Maximum Marks</th><th>Grade</th></tr></thead>
<tbody>${rows}<tr class="avg"><td>Average Score</td><td>${avg}%</td><td>100</td><td>-</td></tr></tbody>
</table>
<p class="lbl">Teacher Remarks</p>
<div class="narr">${narrative}</div>
<div class="sigs">
<div class="sig"><span class="sig-line"></span><p class="sig-name">Class Teacher</p></div>
<div class="sig"><span class="sig-line"></span><p class="sig-name">Principal</p></div>
<div class="sig"><span class="sig-line"></span><p class="sig-name">Parent / Guardian</p></div>
</div>
</div>
<div class="ftr">${SCHOOL_NAME} &nbsp;|&nbsp; Suchitra Circle, Hyderabad - 500067 &nbsp;|&nbsp; admin@suchitracademy.edu.in &nbsp;|&nbsp; Generated on ${today}</div>
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

    const typedStudents = students as StudentRow[];

    const { data: records } = await supabaseAdmin
      .from('academic_records')
      .select('student_id, subject, marks_obtained, max_marks, grade')
      .eq('school_id', SCHOOL_ID)
      .eq('term', term)
      .in('student_id', typedStudents.map(s => s.id));

    const typedRecords = (records ?? []) as AcademicRow[];

    const recordsByStudent = new Map<string, AcademicRow[]>();
    for (const r of typedRecords) {
      const existing = recordsByStudent.get(r.student_id) ?? [];
      existing.push(r);
      recordsByStudent.set(r.student_id, existing);
    }

    const reports: { name: string; fileName: string; html: string }[] = [];

    for (const student of typedStudents) {
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

      const html = buildReportHTML(
        student.name,
        student.class,
        student.section,
        student.admission_number ?? '-',
        subjects,
        narrative,
        term
      );

      reports.push({
        name: student.name,
        fileName: `${student.name.replace(/\s+/g, '_')}_Class${student.class}${student.section}_Report.html`,
        html,
      });
    }

    return NextResponse.json({ success: true, count: reports.length, term, reports });

  } catch (err) {
    console.error('Report card error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
