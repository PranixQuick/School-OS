// app/api/parent/report-cards/download/route.ts
// Parent report card PDF download.
// Auth: getParentSession cookie-first, phone+PIN body fallback.
// Branded: the institution logo, colours, tagline and authorised signature are applied
// from the school's branding profile ("upload once, applied everywhere").

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';
import { getSchoolBranding } from '@/lib/branding';
import { jsPDF } from 'jspdf';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

function calcGrade(pct: number): string {
  if (pct >= 90) return 'A+'; if (pct >= 80) return 'A'; if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B'; if (pct >= 50) return 'C'; if (pct >= 40) return 'D';
  return 'F';
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [17, 24, 39];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// jsPDF addImage only rasters PNG/JPEG. SVG/WebP logos are skipped gracefully.
async function fetchImage(url: string | null): Promise<{ data: string; fmt: 'PNG' | 'JPEG' } | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    let fmt: 'PNG' | 'JPEG' | null = ct.includes('png') ? 'PNG' : (ct.includes('jpeg') || ct.includes('jpg')) ? 'JPEG' : null;
    if (!fmt) { if (/\.png(\?|$)/i.test(url)) fmt = 'PNG'; else if (/\.jpe?g(\?|$)/i.test(url)) fmt = 'JPEG'; }
    if (!fmt) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return { data: `data:image/${fmt.toLowerCase()};base64,${buf.toString('base64')}`, fmt };
  } catch { return null; }
}

async function resolveParent(req: NextRequest): Promise<{ schoolId: string; studentId: string } | null> {
  const session = await getParentSession(req);
  if (session) return { schoolId: session.schoolId, studentId: session.studentId };

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

  const term = req.nextUrl.searchParams.get('term');
  if (!term) return NextResponse.json({ error: 'term query param required' }, { status: 400 });

  const { schoolId, studentId } = parent;

  const [studentRes, schoolRes, branding] = await Promise.all([
    supabaseAdmin.from('students').select('name, class, section, roll_number').eq('id', studentId).eq('school_id', schoolId).maybeSingle(),
    supabaseAdmin.from('schools').select('name, address').eq('id', schoolId).maybeSingle(),
    getSchoolBranding(schoolId),
  ]);
  const student = studentRes.data;
  const school = schoolRes.data;

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

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const [pr, pg, pb] = hexToRgb(branding.primary_color);
  const [logoImg, signImg] = await Promise.all([fetchImage(branding.logo_url), fetchImage(branding.signature_url)]);

  // Branded header
  if (logoImg) { try { doc.addImage(logoImg.data, logoImg.fmt, 15, 11, 18, 18); } catch { /* skip */ } }
  doc.setTextColor(pr, pg, pb);
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.text(branding.name || school?.name || 'School', pw / 2, 18, { align: 'center' });
  doc.setTextColor(60, 60, 60);
  let hy = 23;
  if (branding.tagline) { doc.setFontSize(8).setFont('helvetica', 'italic'); doc.text(branding.tagline, pw / 2, hy, { align: 'center' }); hy += 4; }
  const addr = branding.address || school?.address;
  if (addr) { doc.setFontSize(8).setFont('helvetica', 'normal'); doc.text(addr, pw / 2, hy, { align: 'center' }); }
  doc.setTextColor(pr, pg, pb);
  doc.setFontSize(13).setFont('helvetica', 'bold');
  doc.text('REPORT CARD', pw / 2, 32, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(pr, pg, pb).setLineWidth(0.6); doc.line(15, 35, pw - 15, 35);
  doc.setDrawColor(0, 0, 0).setLineWidth(0.2);

  let y = 42;
  doc.setFontSize(9).setFont('helvetica', 'normal');
  [['Student Name', student?.name ?? 'N/A', 'Term', termLabel],
  ['Class', className, 'Roll No', String(student?.roll_number ?? 'N/A')]
  ].forEach(([l1, v1, l2, v2]) => {
    doc.setFont('helvetica', 'bold').text(`${l1}:`, 15, y);
    doc.setFont('helvetica', 'normal').text(v1, 50, y);
    doc.setFont('helvetica', 'bold').text(`${l2}:`, 120, y);
    doc.setFont('helvetica', 'normal').text(v2, 155, y);
    y += 6;
  });
  doc.line(15, y, pw - 15, y); y += 5;

  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.setFillColor(pr, pg, pb); doc.setTextColor(255, 255, 255); doc.rect(15, y, pw - 30, 7, 'F');
  doc.text('Subject', 18, y + 5); doc.text('Max Marks', 100, y + 5, { align: 'right' });
  doc.text('Marks Obtained', 145, y + 5, { align: 'right' }); doc.text('Grade', 185, y + 5, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  y += 7;
  doc.setFont('helvetica', 'normal');
  marks.forEach((m, i) => {
    if (i % 2 === 0) { doc.setFillColor(252, 252, 252); doc.rect(15, y, pw - 30, 6, 'F'); }
    doc.text(m.subject ?? '', 18, y + 4.5);
    doc.text(String(m.max_marks ?? ''), 100, y + 4.5, { align: 'right' });
    doc.text(String(m.marks_obtained ?? ''), 145, y + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'bold').text(m.grade ?? calcGrade(Number(m.max_marks) > 0 ? (Number(m.marks_obtained) / Number(m.max_marks)) * 100 : 0), 185, y + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'normal'); y += 6;
  });
  doc.line(15, y, pw - 15, y); y += 1;
  doc.setFont('helvetica', 'bold').setFillColor(230, 245, 230); doc.rect(15, y, pw - 30, 7, 'F');
  doc.text('TOTAL', 18, y + 5); doc.text(String(totalMax), 100, y + 5, { align: 'right' });
  doc.text(String(totalObt), 145, y + 5, { align: 'right' }); doc.text(overallGrade, 185, y + 5, { align: 'right' });
  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.text(`Percentage: ${percentage.toFixed(1)}%    Overall Grade: ${overallGrade}`, 18, y); y += 5;
  doc.line(15, y, pw - 15, y); y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(promoted ? 0 : 180, promoted ? 120 : 0, 0);
  doc.text(promoted ? 'Promoted to next class' : 'Detained — Below passing threshold', 15, y);
  doc.setTextColor(0, 0, 0); y += 16;
  if (signImg) { try { doc.addImage(signImg.data, signImg.fmt, pw - 58, y - 13, 28, 11); } catch { /* skip */ } }
  doc.line(15, y, 65, y); doc.line(pw - 65, y, pw - 15, y); y += 5;
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text("Class Teacher's Signature", 15, y);
  doc.text("Principal's Signature", pw - 15, y, { align: 'right' });

  const pdfBase64 = doc.output('datauristring').split(',')[1];
  return NextResponse.json({ pdf_base64: pdfBase64, student_name: student?.name ?? '', term, percentage: parseFloat(percentage.toFixed(1)), grade: overallGrade });
}

// POST retained for backward compat (old body-auth clients)
export async function POST(req: NextRequest) { return GET(req); }
