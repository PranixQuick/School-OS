// app/api/admin/transfer-certificates/[id]/section-65b-certificate/route.ts
// Batch 8 — Section 65B certificate PDF for a TC.
// Fetches TC + 65B log → generates signed PDF → returns base64.
// staff table has: id, name (no designation column).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { jsPDF } from 'jspdf';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return await requireAdminSession(req); }
  catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try { return await requirePrincipalSession(req); }
    catch (pe) { if (pe instanceof PrincipalAuthError) return null; throw pe; }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;
  const { id: tcId } = await params;

  // Fetch TC + student + school
  const { data: tc } = await supabaseAdmin
    .from('transfer_certificates')
    .select('id, tc_number, section_65b_hash, issued_at, status, student_id, students(name, class, section), schools(name, address)')
    .eq('id', tcId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!tc) return NextResponse.json({ error: 'TC not found' }, { status: 404 });

  const student = Array.isArray(tc.students) ? (tc.students[0] as { name: string; class: string; section: string } | undefined) : tc.students as { name: string; class: string; section: string } | null;
  const school = Array.isArray(tc.schools) ? (tc.schools[0] as { name: string; address: string } | undefined) : tc.schools as { name: string; address: string } | null;
  const studentName = student?.name ?? 'N/A';
  const schoolName = school?.name ?? 'The School';
  const schoolAddress = school?.address ?? '';

  // Fetch 65B log for this TC
  const { data: logRows } = await supabaseAdmin
    .from('tc_section_65b_log')
    .select('event_type, event_at, performed_by, document_hash, metadata')
    .eq('tc_id', tcId)
    .eq('school_id', schoolId)
    .order('event_at', { ascending: true });

  // Enrich with staff names
  const staffIds = [...new Set((logRows ?? []).map(r => r.performed_by).filter(Boolean))];
  const { data: staffRows } = staffIds.length
    ? await supabaseAdmin.from('staff').select('id, name').in('id', staffIds)
    : { data: [] };
  const staffMap = new Map((staffRows ?? []).map(s => [s.id, s.name]));

  // Generate PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const issuedDate = tc.issued_at ? new Date(tc.issued_at as string).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

  // Title
  doc.setFontSize(11).setFont('helvetica', 'bold');
  const title = 'CERTIFICATE UNDER SECTION 65B OF THE INDIAN EVIDENCE ACT, 1872';
  const titleLines = doc.splitTextToSize(title, pw - 30) as string[];
  doc.text(titleLines, pw / 2, 20, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(15, 28, pw - 15, 28);

  // Body
  doc.setFontSize(10).setFont('helvetica', 'normal');
  let y = 36;
  const lineH = 6;

  const certText = [
    `I, Principal / Authorized Signatory, ${schoolName}, ${schoolAddress},`,
    `do hereby certify that the electronic record described below was produced from the computer`,
    `system maintained by ${schoolName} in the ordinary course of its activities.`,
  ];
  certText.forEach(line => { doc.text(line, 15, y); y += lineH; });
  y += 4;

  // Document details
  doc.setFont('helvetica', 'bold').text('Document Details:', 15, y); y += lineH;
  doc.setFont('helvetica', 'normal');
  [
    ['Transfer Certificate No.', (tc.tc_number as string) ?? 'N/A'],
    ['Student Name', studentName],
    ['Date of Issue', issuedDate],
    ['SHA-256 Hash', (tc.section_65b_hash as string) ?? 'Not available'],
  ].forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold').text(`${label}:`, 20, y);
    const valueLines = doc.splitTextToSize(String(value), pw - 80) as string[];
    doc.setFont('helvetica', 'normal').text(valueLines, 80, y);
    y += Math.max(lineH, valueLines.length * lineH);
  });
  y += 4;

  // Event log
  doc.setFont('helvetica', 'bold').text('System Event Log:', 15, y); y += lineH;

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, pw - 30, 7, 'F');
  doc.setFontSize(9).text('Event', 18, y + 5);
  doc.text('Date & Time', 80, y + 5);
  doc.text('Performed By', 145, y + 5);
  y += 7;

  doc.setFont('helvetica', 'normal').setFontSize(9);
  for (const row of logRows ?? []) {
    const eventType = String(row.event_type ?? '').replace(/_/g, ' ');
    const eventAt = row.event_at ? new Date(row.event_at as string).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const performer = row.performed_by ? (staffMap.get(row.performed_by as string) ?? 'System') : 'System';
    doc.text(eventType, 18, y + 4.5);
    doc.text(eventAt, 80, y + 4.5);
    doc.text(performer, 145, y + 4.5);
    y += 7;
    if (y > 265) { doc.addPage(); y = 20; }
  }
  y += 6;

  // Footer text
  doc.setFontSize(10).setFont('helvetica', 'normal');
  const footerLines = [
    'The computer system was functioning properly at all relevant times.',
    'This certificate is issued for the purpose of legal proceedings under Section 65B',
    'of the Indian Evidence Act, 1872.',
  ];
  footerLines.forEach(line => { doc.text(line, 15, y); y += lineH; });
  y += 10;

  // Signature block
  doc.line(15, y, 80, y);
  y += 5;
  doc.setFont('helvetica', 'bold').text('Principal / Authorized Signatory', 15, y); y += lineH;
  doc.setFont('helvetica', 'normal').text(schoolName, 15, y); y += lineH;
  doc.text(`Date: ${today}`, 15, y);

  const pdfBase64 = doc.output('datauristring').split(',')[1];

  return NextResponse.json({
    pdf_base64: pdfBase64,
    tc_number: tc.tc_number,
    student_name: studentName,
  });
}
