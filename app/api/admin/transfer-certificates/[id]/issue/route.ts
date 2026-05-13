// app/api/admin/transfer-certificates/[id]/issue/route.ts
// Item #11 TC Lifecycle — PR #2
// POST: issue TC — generates PDF, stores hash (Section 65B), marks student exit
//
// Flow: guards → fetch → generate TC number → generate PDF → SHA-256 hash →
//       UPDATE tc → UPDATE student → log 65B events → notify
//
// jsPDF runs server-side (Node.js). No browser canvas needed.
// crypto is Node.js built-in — no install.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';
import { createHash } from 'crypto';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function resolveSession(req: NextRequest) {
  try {
    const ctx = await requireAdminSession(req);
    return { schoolId: ctx.schoolId, userId: ctx.userId, staffId: ctx.staffId };
  } catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try {
      const ctx = await requirePrincipalSession(req);
      return { schoolId: ctx.schoolId, userId: ctx.session.userId, staffId: ctx.staffId };
    } catch (pe) {
      if (pe instanceof PrincipalAuthError) return null;
      throw pe;
    }
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function generateTcPdf(params: {
  tcNumber: string;
  schoolName: string;
  schoolAddress: string;
  studentName: string;
  parentName: string | null;
  studentClass: string;
  studentSection: string;
  admissionNumber: string | null;
  rollNumber: string | null;
  academicYearLabel: string | null;
  reasonCategory: string;
  graduationStatus: string | null;
  issuedAt: Date;
}): Promise<string> {
  // Dynamic import to avoid SSR issues
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const margin = 20;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(params.schoolName, pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (params.schoolAddress) {
    doc.text(params.schoolAddress, pageWidth / 2, 29, { align: 'center', maxWidth: 160 });
  }

  // Divider
  doc.setDrawColor(100, 100, 100);
  doc.line(margin, 34, pageWidth - margin, 34);

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TRANSFER CERTIFICATE', pageWidth / 2, 42, { align: 'center' });

  doc.line(margin, 46, pageWidth - margin, 46);

  // ── Fields ───────────────────────────────────────────────────────────────────
  const rows: [string, string][] = [
    ['TC Number',               params.tcNumber],
    ['Date of Issue',           formatDate(params.issuedAt)],
    ['Student Name',            params.studentName],
    ['Father / Guardian Name',  params.parentName ?? '—'],
    ['Class Last Studied',      `${params.studentClass} - ${params.studentSection}`],
    ['Academic Year',           params.academicYearLabel ?? '—'],
    ['Admission Number',        params.admissionNumber ?? '—'],
    ['Roll Number',             params.rollNumber ?? '—'],
    ['Date of Leaving',         formatDate(params.issuedAt)],
    ['Reason for Leaving',      params.reasonCategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
    ['Conduct',                 'Good'],
    ['Eligible for Promotion',  params.graduationStatus === 'graduated' ? 'Yes (Graduated)' : 'Yes'],
    ['Remarks',                 '—'],
  ];

  let y = 56;
  const labelX = margin;
  const colonX = 90;
  const valueX = 95;

  doc.setFontSize(10);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, y);
    doc.text(':', colonX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), valueX, y, { maxWidth: pageWidth - valueX - margin });
    y += 9;
    // Row separator (light)
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y - 3, pageWidth - margin, y - 3);
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  y += 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(
    'Certified that the above information is correct as per school records and the TC is issued in good faith.',
    margin, y, { maxWidth: pageWidth - 2 * margin }
  );

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Principal / Authorized Signatory', pageWidth - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(params.schoolName, pageWidth - margin, y + 7, { align: 'right' });

  // Section 65B note
  y += 24;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('This document is digitally generated and hash-verified per Section 65B, Indian Evidence Act.', margin, y);

  return (doc.output('datauristring') as string).split(',')[1];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid TC id' }, { status: 400 });

  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId, staffId } = ctx;

  // ── Fetch TC ──────────────────────────────────────────────────────────────────
  const { data: tc, error: tcErr } = await supabaseAdmin
    .from('transfer_certificates')
    .select('id, status, fee_clearance_status, student_id, academic_year_id, reason, reason_category')
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (tcErr) return NextResponse.json({ error: tcErr.message }, { status: 500 });
  if (!tc) return NextResponse.json({ error: 'TC not found' }, { status: 404 });

  // ── Guards ────────────────────────────────────────────────────────────────────
  if (tc.status !== 'approved') {
    return NextResponse.json({ error: 'not_approved', message: `TC status is '${tc.status}', must be 'approved' to issue.` }, { status: 400 });
  }
  if (!['cleared', 'waived'].includes(tc.fee_clearance_status)) {
    return NextResponse.json({ error: 'fee_clearance_required', message: 'Outstanding fees must be cleared or waived before issuing TC.' }, { status: 400 });
  }

  // ── Fetch student + school ────────────────────────────────────────────────────
  const [studentRes, schoolRes] = await Promise.all([
    supabaseAdmin.from('students')
      .select('id, name, class, section, roll_number, admission_number, parent_name, graduation_status')
      .eq('id', tc.student_id).eq('school_id', schoolId).maybeSingle(),
    supabaseAdmin.from('schools').select('name, address').eq('id', schoolId).maybeSingle(),
  ]);
  if (!studentRes.data) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  if (!schoolRes.data) return NextResponse.json({ error: 'School not found' }, { status: 500 });

  const student = studentRes.data;
  const school = schoolRes.data;

  // Fetch academic year label
  let academicYearLabel: string | null = null;
  if (tc.academic_year_id) {
    const { data: ay } = await supabaseAdmin.from('academic_years')
      .select('label').eq('id', tc.academic_year_id).maybeSingle();
    academicYearLabel = ay?.label ?? null;
  }

  // ── Generate TC number ────────────────────────────────────────────────────────
  const { data: tcNumRow, error: tcNumErr } = await supabaseAdmin
    .rpc('generate_tc_number', { p_school_id: schoolId });
  if (tcNumErr) return NextResponse.json({ error: `TC number generation failed: ${tcNumErr.message}` }, { status: 500 });
  const tcNumber = tcNumRow as string;

  // ── Generate PDF ──────────────────────────────────────────────────────────────
  const issuedAt = new Date();
  const pdfBase64 = await generateTcPdf({
    tcNumber,
    schoolName: school.name,
    schoolAddress: school.address ?? '',
    studentName: student.name,
    parentName: student.parent_name,
    studentClass: student.class,
    studentSection: student.section,
    admissionNumber: student.admission_number,
    rollNumber: student.roll_number,
    academicYearLabel,
    reasonCategory: tc.reason_category,
    graduationStatus: student.graduation_status,
    issuedAt,
  });

  // ── SHA-256 hash (Section 65B) ────────────────────────────────────────────────
  const pdfHash = createHash('sha256')
    .update(Buffer.from(pdfBase64, 'base64'))
    .digest('hex');

  const now = issuedAt.toISOString();

  // ── UPDATE transfer_certificates ─────────────────────────────────────────────
  const { error: updateErr } = await supabaseAdmin.from('transfer_certificates').update({
    status: 'issued',
    tc_number: tcNumber,
    issued_at: now,
    issued_by: staffId,
    pdf_content: pdfBase64,
    section_65b_logged: true,
    section_65b_logged_at: now,
    section_65b_hash: pdfHash,
    exit_completed: true,
    exit_completed_at: now,
    updated_at: now,
  }).eq('id', id).eq('school_id', schoolId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // ── STUDENT EXIT (soft — never delete) ───────────────────────────────────────
  await supabaseAdmin.from('students').update({
    is_active: false,
    graduation_status: 'graduated',
    graduated_at: now,
  }).eq('id', tc.student_id).eq('school_id', schoolId);

  // ── Section 65B event log ─────────────────────────────────────────────────────
  await supabaseAdmin.rpc('log_tc_event', {
    p_tc_id: id, p_school_id: schoolId, p_student_id: tc.student_id,
    p_event_type: 'tc_issued', p_performed_by: staffId,
    p_doc_hash: pdfHash,
    p_metadata: { tc_number: tcNumber, issued_at: now },
  });
  await supabaseAdmin.rpc('log_tc_event', {
    p_tc_id: id, p_school_id: schoolId, p_student_id: tc.student_id,
    p_event_type: 'exit_completed', p_performed_by: staffId,
    p_doc_hash: null, p_metadata: { student_name: student.name },
  });

  // ── Notification (best-effort, non-fatal) ─────────────────────────────────────
  try {
    await supabaseAdmin.from('notifications').insert({
      school_id: schoolId, type: 'system',
      title: `TC issued: ${tcNumber}`,
      message: `Transfer Certificate ${tcNumber} issued for ${student.name}.`,
      target_count: 1, module: 'tc', reference_id: id,
      status: 'pending', channel: 'whatsapp', attempts: 0,
    });
  } catch (e) { console.error('[tc] issuance notification failed (non-fatal):', e); }

  return NextResponse.json({
    success: true,
    tc_number: tcNumber,
    issued_at: now,
    pdf_base64: pdfBase64,
    section_65b_hash: pdfHash,
    student_name: student.name,
  });
}
