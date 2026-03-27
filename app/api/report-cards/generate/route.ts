// /app/api/report-cards/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { validateAndTrackApiKey } from '@/lib/apiKey';
import { callClaude } from '@/lib/claudeClient';
import PDFDocument from 'pdfkit';
import JSZip from 'jszip';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const SCHOOL_NAME = 'Suchitra Academy';
const SCHOOL_TAGLINE = 'CBSE School | Hyderabad';

// ── Generate narrative via Claude ──────────────────────────────────────────
async function generateNarrative(student: {
  name: string;
  class: string;
  section: string;
  subjects: { subject: string; marks: number; max: number; grade: string }[];
}): Promise<string> {
  const subjectLines = student.subjects
    .map(s => `- ${s.subject}: ${s.marks}/${s.max} (Grade ${s.grade})`)
    .join('\n');

  const avg = Math.round(
    student.subjects.reduce((sum, s) => sum + s.marks, 0) / student.subjects.length
  );

  const system = `You are a professional school teacher writing a student progress narrative for a report card. 
Write in a warm, encouraging, and professional tone. 
Output exactly ONE paragraph between 80 and 120 words. 
No bullet points, no headers, no symbols. Plain flowing prose only.
Do not start with the student's name — start with an observation about their performance.`;

  const userMsg = `Student: ${student.name}
Class: ${student.class}${student.section}
School: ${SCHOOL_NAME}

Academic performance this term:
${subjectLines}

Average: ${avg}%

Write a professional teacher's narrative comment for this student's report card.`;

  return await callClaude(system, userMsg, 200);
}

// ── Generate single PDF buffer ─────────────────────────────────────────────
function generatePDF(student: {
  name: string;
  class: string;
  section: string;
  admissionNumber: string;
  subjects: { subject: string; marks: number; max: number; grade: string }[];
  narrative: string;
  term: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28;
    const MARGIN = 60;
    const CONTENT_W = W - MARGIN * 2;

    // ── Header bar ──
    doc.rect(0, 0, W, 90).fill('#0F6E56');
    doc.fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(SCHOOL_NAME, MARGIN, 22, { width: CONTENT_W });
    doc.fillColor('#9FE1CB')
      .font('Helvetica')
      .fontSize(11)
      .text(SCHOOL_TAGLINE, MARGIN, 48, { width: CONTENT_W });
    doc.fillColor('#E1F5EE')
      .fontSize(10)
      .text(`Progress Report — ${student.term}`, MARGIN, 66, { width: CONTENT_W });

    // ── Student info block ──
    const infoY = 110;
    doc.rect(MARGIN, infoY, CONTENT_W, 64).fill('#F1EFE8').stroke('#D3D1C7');
    doc.fillColor('#2C2C2A').font('Helvetica-Bold').fontSize(16)
      .text(student.name, MARGIN + 16, infoY + 10, { width: CONTENT_W - 32 });
    doc.fillColor('#5F5E5A').font('Helvetica').fontSize(10)
      .text(
        `Class ${student.class}-${student.section}   |   Admission No: ${student.admissionNumber}   |   ${SCHOOL_NAME}`,
        MARGIN + 16, infoY + 34
      );

    // ── Section: Academic Performance ──
    let y = infoY + 88;
    doc.fillColor('#0F6E56').font('Helvetica-Bold').fontSize(11)
      .text('Academic Performance', MARGIN, y);
    y += 18;

    // Table header
    doc.rect(MARGIN, y, CONTENT_W, 24).fill('#0F6E56');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('Subject', MARGIN + 10, y + 7);
    doc.text('Marks Obtained', MARGIN + 200, y + 7);
    doc.text('Max Marks', MARGIN + 310, y + 7);
    doc.text('Grade', MARGIN + 400, y + 7);
    y += 24;

    // Table rows
    student.subjects.forEach((s, i) => {
      const rowBg = i % 2 === 0 ? '#ffffff' : '#F1EFE8';
      doc.rect(MARGIN, y, CONTENT_W, 22).fill(rowBg).stroke('#D3D1C7');
      doc.fillColor('#2C2C2A').font('Helvetica').fontSize(9);
      doc.text(s.subject, MARGIN + 10, y + 7);
      doc.text(String(s.marks), MARGIN + 200, y + 7);
      doc.text(String(s.max), MARGIN + 310, y + 7);
      const gradeColor = s.grade.startsWith('A') ? '#0F6E56' : s.grade.startsWith('B') ? '#854F0B' : '#993C1D';
      doc.fillColor(gradeColor).font('Helvetica-Bold').text(s.grade, MARGIN + 400, y + 7);
      y += 22;
    });

    // Average row
    const avg = Math.round(student.subjects.reduce((sum, s) => sum + s.marks, 0) / student.subjects.length);
    doc.rect(MARGIN, y, CONTENT_W, 24).fill('#E1F5EE').stroke('#1D9E75');
    doc.fillColor('#0F6E56').font('Helvetica-Bold').fontSize(9);
    doc.text('Average Score', MARGIN + 10, y + 7);
    doc.text(`${avg}%`, MARGIN + 200, y + 7);
    y += 36;

    // ── Section: Teacher's Remarks ──
    doc.fillColor('#0F6E56').font('Helvetica-Bold').fontSize(11)
      .text("Teacher's Remarks", MARGIN, y);
    y += 18;

    doc.rect(MARGIN, y, CONTENT_W, 120).fill('#FAFAF8').stroke('#D3D1C7');
    doc.fillColor('#2C2C2A').font('Helvetica').fontSize(10)
      .text(student.narrative, MARGIN + 14, y + 14, {
        width: CONTENT_W - 28,
        height: 92,
        lineGap: 4,
      });
    y += 138;

    // ── Signature block ──
    y = Math.max(y, 640);
    doc.moveTo(MARGIN, y).lineTo(MARGIN + 130, y).stroke('#D3D1C7');
    doc.moveTo(MARGIN + 200, y).lineTo(MARGIN + 330, y).stroke('#D3D1C7');
    doc.moveTo(MARGIN + 400, y).lineTo(CONTENT_W + MARGIN, y).stroke('#D3D1C7');

    doc.fillColor('#5F5E5A').font('Helvetica').fontSize(8);
    doc.text("Class Teacher", MARGIN, y + 6);
    doc.text("Principal", MARGIN + 200, y + 6);
    doc.text("Parent / Guardian", MARGIN + 400, y + 6);

    // ── Footer ──
    doc.rect(0, 770, W, 72).fill('#F1EFE8');
    doc.fillColor('#5F5E5A').font('Helvetica').fontSize(8)
      .text(
        `${SCHOOL_NAME}  ·  Suchitra Circle, Hyderabad - 500067  ·  admin@suchitracademy.edu.in`,
        MARGIN, 785, { width: CONTENT_W, align: 'center' }
      );
    doc.fillColor('#0F6E56').font('Helvetica-Bold').fontSize(8)
      .text(
        `Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        MARGIN, 800, { width: CONTENT_W, align: 'center' }
      );

    doc.end();
  });
}

// ── Main API Route ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { classNum, section, term } = body as {
      classNum: string;
      section: string;
      term: string;
    };

    if (!classNum || !section || !term) {
      return NextResponse.json({ error: 'classNum, section, term required' }, { status: 400 });
    }

    // Validate internal API key
    const apiKey = await (await import('@/lib/apiKey')).getActiveApiKey();
    if (apiKey) {
      await validateAndTrackApiKey(apiKey);
    }

    // 1. Fetch students
    const { data: students, error: studErr } = await supabaseAdmin
      .from('students')
      .select('id, name, class, section, admission_number')
      .eq('school_id', SCHOOL_ID)
      .eq('class', classNum)
      .eq('section', section)
      .eq('is_active', true)
      .order('roll_number');

    if (studErr || !students?.length) {
      return NextResponse.json({ error: 'No students found for this class' }, { status: 404 });
    }

    // 2. Fetch academic records for all students
    const studentIds = students.map(s => s.id);
    const { data: records } = await supabaseAdmin
      .from('academic_records')
      .select('student_id, subject, marks_obtained, max_marks, grade')
      .eq('school_id', SCHOOL_ID)
      .eq('term', term)
      .in('student_id', studentIds);

    // 3. Group records by student
    const recordsByStudent = new Map<string, typeof records>();
    for (const r of records ?? []) {
      if (!recordsByStudent.has(r.student_id)) recordsByStudent.set(r.student_id, []);
      recordsByStudent.get(r.student_id)!.push(r);
    }

    // 4. Generate narratives + PDFs per student
    const zip = new JSZip();
    const results: { name: string; status: string }[] = [];

    for (const student of students) {
      const subjectRecords = recordsByStudent.get(student.id) ?? [];
      const subjects = subjectRecords.map(r => ({
        subject: r.subject,
        marks: Number(r.marks_obtained),
        max: Number(r.max_marks),
        grade: r.grade ?? '-',
      }));

      // Generate narrative
      let narrative = 'The student has demonstrated consistent effort throughout the term.';
      try {
        narrative = await generateNarrative({
          name: student.name,
          class: student.class,
          section: student.section,
          subjects,
        });
      } catch (e) {
        console.error(`Claude error for ${student.name}:`, e);
      }

      // Store narrative in DB
      await supabaseAdmin.from('report_narratives').upsert({
        school_id: SCHOOL_ID,
        student_id: student.id,
        term,
        narrative_text: narrative,
        status: 'draft',
        generated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,term' });

      // Generate PDF
      const pdfBuffer = await generatePDF({
        name: student.name,
        class: student.class,
        section: student.section,
        admissionNumber: student.admission_number ?? '-',
        subjects,
        narrative,
        term,
      });

      const fileName = `${student.name.replace(/\s+/g, '_')}_${student.class}${student.section}_Report.pdf`;
      zip.file(fileName, pdfBuffer);
      results.push({ name: student.name, status: 'generated' });
    }

    // 5. Build ZIP
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="ReportCards_Class${classNum}${section}_${term.replace(/\s+/g, '_')}.zip"`,
        'X-Generated-Count': String(results.length),
      },
    });

  } catch (err) {
    console.error('Report card generation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
