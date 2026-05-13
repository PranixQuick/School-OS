// app/api/admin/fees/[id]/gst-invoice/route.ts
// Batch 8 — Generate GST invoice PDF for a paid fee.
// gst_rate + tax_amount already exist on fees table.
// HSN 9992 = education services. institutions has name + address (no gstin column).
// Auth: requireAdminSession.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { jsPDF } from 'jspdf';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return null; throw e; }
}

function amountInWords(amount: number): string {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (amount === 0) return 'Zero';
  const intPart = Math.floor(amount);
  const parts: string[] = [];
  if (intPart >= 1000) { parts.push(`${ones[Math.floor(intPart/1000)]} Thousand`); }
  const rem = intPart % 1000;
  if (rem >= 100) { parts.push(`${ones[Math.floor(rem/100)]} Hundred`); }
  const rem2 = rem % 100;
  if (rem2 >= 20) { parts.push(`${tens[Math.floor(rem2/10)]}${rem2%10 ? ' '+ones[rem2%10] : ''}`); }
  else if (rem2 > 0) { parts.push(ones[rem2]); }
  return parts.join(' ') + ' Rupees Only';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;
  const { id: feeId } = await params;

  const { data: fee } = await supabaseAdmin
    .from('fees')
    .select('id, fee_type, amount, status, gst_rate, tax_amount, fee_receipt_number, paid_date, student_id, students(name, class, section, parents(name)), schools(name, address)')
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  if (fee.status !== 'paid') return NextResponse.json({ error: 'GST invoice can only be generated for paid fees' }, { status: 400 });

  const student = Array.isArray(fee.students) ? (fee.students[0] as Record<string,unknown> | undefined) : fee.students as Record<string,unknown> | null;
  const school = Array.isArray(fee.schools) ? (fee.schools[0] as { name: string; address: string } | undefined) : fee.schools as { name: string; address: string } | null;
  const parents = student ? (Array.isArray(student.parents) ? student.parents[0] : student.parents) as { name: string } | null : null;

  const studentName = String(student?.name ?? 'N/A');
  const studentClass = `Grade ${student?.class ?? '?'}${student?.section ? '-' + student.section : ''}`;
  const parentName = parents?.name ?? 'N/A';
  const schoolName = school?.name ?? 'School';
  const schoolAddress = school?.address ?? '';

  const feeAmount = Number(fee.amount ?? 0);
  const gstRate = Number(fee.gst_rate ?? 0);
  const taxAmount = Number(fee.tax_amount ?? (gstRate > 0 ? feeAmount * gstRate / 100 : 0));
  const taxableAmount = gstRate > 0 ? feeAmount - taxAmount : feeAmount;
  const invoiceNo = (fee.fee_receipt_number as string | null) ?? `INV-${(feeId as string).slice(0, 8).toUpperCase()}`;
  const invoiceDate = fee.paid_date ? new Date(fee.paid_date as string).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

  // Generate PDF
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pw / 2, 18, { align: 'center' });
  doc.setFontSize(12).text(schoolName, pw / 2, 26, { align: 'center' });
  doc.setFontSize(9).setFont('helvetica', 'normal');
  if (schoolAddress) doc.text(schoolAddress, pw / 2, 32, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(15, 36, pw - 15, 36);

  // Invoice details
  let y = 42;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold').text(`Invoice No: ${invoiceNo}`, 15, y);
  doc.text(`Date: ${invoiceDate}`, pw - 15, y, { align: 'right' });
  y += 8;

  // Bill To
  doc.setFont('helvetica', 'bold').text('Bill To:', 15, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Parent / Guardian: ${parentName}`, 20, y); y += 5;
  doc.text(`Student: ${studentName}`, 20, y); y += 5;
  doc.text(`Class: ${studentClass}`, 20, y); y += 8;
  doc.line(15, y, pw - 15, y); y += 4;

  // Line items table header
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y, pw - 30, 7, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8);
  doc.text('Description', 18, y + 5);
  doc.text('HSN/SAC', 80, y + 5);
  doc.text('Amount (₹)', 110, y + 5);
  doc.text(`GST ${gstRate}%`, 145, y + 5);
  doc.text('Total (₹)', 175, y + 5, { align: 'right' });
  y += 7;

  // Line item row
  doc.setFont('helvetica', 'normal');
  doc.text(fee.fee_type as string ?? 'School Fee', 18, y + 4.5);
  doc.text('9992', 80, y + 4.5);
  doc.text(taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 110, y + 4.5);
  doc.text(taxAmount > 0 ? taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—', 145, y + 4.5);
  doc.text(feeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 175, y + 4.5, { align: 'right' });
  y += 8;
  doc.line(15, y, pw - 15, y); y += 4;

  // Summary
  doc.setFont('helvetica', 'normal');
  [
    ['Taxable Amount:', `₹${taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
    [`GST (${gstRate}%):`, `₹${taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`],
  ].forEach(([label, value]) => {
    doc.text(label, 120, y); doc.text(value, pw - 15, y, { align: 'right' }); y += 5;
  });
  doc.setFont('helvetica', 'bold');
  doc.text('Total Amount:', 120, y);
  doc.text(`₹${feeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pw - 15, y, { align: 'right' });
  y += 8;

  // Amount in words
  doc.setFont('helvetica', 'normal').setFontSize(9);
  doc.text(`Amount in Words: ${amountInWords(feeAmount)}`, 15, y); y += 10;

  // Footer
  doc.setFontSize(8).setTextColor(120, 120, 120);
  doc.text('This is a computer generated invoice.', pw / 2, y, { align: 'center' }); y += 6;
  doc.setTextColor(0, 0, 0).setFontSize(9).setFont('helvetica', 'bold');
  doc.line(pw - 75, y, pw - 15, y); y += 5;
  doc.text('Authorized Signatory', pw - 15, y, { align: 'right' });
  doc.setFont('helvetica', 'normal').text(schoolName, pw - 15, y + 5, { align: 'right' });

  const pdfBase64 = doc.output('datauristring').split(',')[1];
  return NextResponse.json({ pdf_base64: pdfBase64, invoice_number: invoiceNo, total_amount: feeAmount });
}
