// app/api/parent/report-cards/download/route.ts
// Batch 9 — Parent report card PDF download.
// Auth: phone+PIN. Validates parent owns the student.
// Inlines PDF generation (avoids auth complexity of server→server call).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { jsPDF } from 'jspdf';

export const runtime = 'nodejs';

function calcGrade(pct: number): string {
  if (pct >= 90) return 'A+'; if (pct >= 80) return 'A'; if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B'; if (pct >= 50) return 'C'; if (pct >= 40) return 'D';
  return 'F';
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { phone, pin, term } = body as { phone?: string; pin?: string; term?: string };
  if (!phone || !pin || !term) return NextResponse.json({ error: 'phone, pin, and term are required' }, { status: 400 });

  // Verify parent + ownership
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id')
    .eq('phone', phone)
    .eq('access_pin', pin)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const schoolId = parent.school_id as string;
  const studentId = parent.student_id as string;

  // Fetch student + school
  const [studentRes, schoolRes] = await Promise.all([
    supabaseAdmin.from('students').select('name, class, section, roll_number').eq('id', studentId).eq('school_id', schoolId).maybeSingle(),
    supabaseAdmin.from('schools').select('name, address').eq('id', schoolId).maybeSingle(),
  ]);
  const student = studentRes.data;
  const school = schoolRes.data;

  // Fetch marks for this term
  const { data: marks } = await supabaseAdmin
    .from('academic_records')
    .select('subject, marks_obtained, max_marks, grade')
    .eq('school_id', schoolId).eq('student_id', studentId).eq('term', term)
    .order('subject');
  if (!marks || marks.length === 0) return NextResponse.json({ error: 'No marks found for this term' }, { status: 404 });

  const totalObt = marks.reduce((s, r) => s + Number(r.marks_obtained ?? 0), 0);
  const totalMax = marks.reduce((s, r) => s + Number(r.max_marks ?? 0), 0);
  const percentage = totalMax > 0 ? (totalObt / totalMax) * 100 : 0;
  const overallGrade = calcGrade(percentage);
  const promoted = percentage >= 40;
  const termLabel = term.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const className = student ? `${student.class ?? '?'}${student.section ? '-' + student.section : ''}` : 'N/A';

  // Generate PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.text(school?.name ?? 'School', pw / 2, 18, { align: 'center' });
  doc.setFontSize(9).setFont('helvetica', 'normal');
  if (school?.address) doc.text(school.address, pw / 2, 24, { align: 'center' });
  doc.setFontSize(13).setFont('helvetica', 'bold');
  doc.text('REPORT CARD', pw / 2, 32, { align: 'center' });
  doc.setLineWidth(0.5); doc.line(15, 35, pw - 15, 35);

  let y = 42;
  doc.setFontSize(9).setFont('helvetica', 'normal');
  [['Student Name', student?.name ?? 'N/A', 'Term', termLabel],
   ['Class', className, 'Roll No', student?.roll_number ?? 'N/A']
  ].forEach(([l1,v1,l2,v2]) => {
    doc.setFont('helvetica','bold').text(`${l1}:`,15,y);
    doc.setFont('helvetica','normal').text(v1,50,y);
    doc.setFont('helvetica','bold').text(`${l2}:`,120,y);
    doc.setFont('helvetica','normal').text(v2,155,y);
    y += 6;
  });
  doc.line(15,y,pw-15,y); y+=5;

  doc.setFontSize(9).setFont('helvetica','bold');
  doc.setFillColor(240,240,240); doc.rect(15,y,pw-30,7,'F');
  doc.text('Subject',18,y+5); doc.text('Max Marks',100,y+5,{align:'right'});
  doc.text('Marks Obtained',145,y+5,{align:'right'}); doc.text('Grade',185,y+5,{align:'right'});
  y+=7;
  doc.setFont('helvetica','normal');
  marks.forEach((m,i) => {
    if(i%2===0){doc.setFillColor(252,252,252);doc.rect(15,y,pw-30,6,'F');}
    doc.text(m.subject??'',18,y+4.5);
    doc.text(String(m.max_marks??''),100,y+4.5,{align:'right'});
    doc.text(String(m.marks_obtained??''),145,y+4.5,{align:'right'});
    doc.setFont('helvetica','bold').text(m.grade??calcGrade(Number(m.max_marks)>0?(Number(m.marks_obtained)/Number(m.max_marks))*100:0),185,y+4.5,{align:'right'});
    doc.setFont('helvetica','normal'); y+=6;
  });
  doc.line(15,y,pw-15,y); y+=1;
  doc.setFont('helvetica','bold').setFillColor(230,245,230); doc.rect(15,y,pw-30,7,'F');
  doc.text('TOTAL',18,y+5); doc.text(String(totalMax),100,y+5,{align:'right'});
  doc.text(String(totalObt),145,y+5,{align:'right'}); doc.text(overallGrade,185,y+5,{align:'right'});
  y+=9;
  doc.setFont('helvetica','normal');
  doc.text(`Percentage: ${percentage.toFixed(1)}%     Overall Grade: ${overallGrade}`,18,y); y+=5;
  doc.line(15,y,pw-15,y); y+=5;
  doc.setFont('helvetica','bold');
  doc.setTextColor(promoted?0:180,promoted?120:0,0);
  doc.text(promoted?'✓ Promoted to next class':'✗ Detained — Below passing threshold',15,y);
  doc.setTextColor(0,0,0); y+=12;
  doc.line(15,y,65,y); doc.line(pw-65,y,pw-15,y); y+=5;
  doc.setFont('helvetica','normal').setFontSize(8);
  doc.text("Class Teacher's Signature",15,y);
  doc.text("Principal's Signature",pw-15,y,{align:'right'});

  const pdfBase64 = doc.output('datauristring').split(',')[1];
  return NextResponse.json({ pdf_base64: pdfBase64, student_name: student?.name ?? '', term, percentage: parseFloat(percentage.toFixed(1)), grade: overallGrade });
}
