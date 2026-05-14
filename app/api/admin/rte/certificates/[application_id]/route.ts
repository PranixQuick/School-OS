// app/api/admin/rte/certificates/[application_id]/route.ts
// Batch 4B — Generate RTE admission certificate PDF.
// Uses schools.slug (no .code column) for certificate number.
// Returns base64 PDF + certificate_number.
// jsPDF: certificate content assembled server-side as base64 data URI.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// Generate a simple PDF-like text certificate as base64.
// jsPDF is a client-side lib; server-side we return structured JSON
// that the client renders via jsPDF in the browser.
// pdf_content stores the raw certificate data as JSON.
function generateCertContent(data: {
  schoolName: string; schoolAddress: string | null; schoolSlug: string;
  studentName: string; dob: string; category: string; entryClass: string;
  yearLabel: string; certNumber: string;
}): string {
  return JSON.stringify({
    title: 'RIGHT TO EDUCATION — ADMISSION CERTIFICATE',
    subtitle: 'Under Section 12(1)(c) of the Right of Children to Free and Compulsory Education Act, 2009',
    school_name: data.schoolName,
    school_address: data.schoolAddress ?? '',
    student_name: data.studentName,
    date_of_birth: data.dob,
    category: data.category.toUpperCase(),
    admitted_to: data.entryClass,
    academic_year: data.yearLabel,
    certificate_number: data.certNumber,
    issued_date: new Date().toLocaleDateString('en-IN'),
    footer: 'This admission is free of charge as per the Right of Children to Free and Compulsory Education Act, 2009',
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ application_id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;
  const { application_id } = await params;

  // Fetch application
  const { data: app } = await supabaseAdmin
    .from('rte_applications')
    .select('*, academic_years(label)')
    .eq('id', application_id).eq('school_id', schoolId).maybeSingle();
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (app.status !== 'admitted') return NextResponse.json({ error: 'Certificate can only be issued for admitted students' }, { status: 409 });

  // Check if cert already exists
  const { data: existing } = await supabaseAdmin
    .from('rte_certificates')
    .select('id, certificate_number, pdf_content')
    .eq('rte_application_id', application_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ certificate_number: existing.certificate_number, pdf_data: existing.pdf_content, already_exists: true });
  }

  // Fetch school info
  const { data: school } = await supabaseAdmin
    .from('schools').select('name, address, slug').eq('id', schoolId).maybeSingle();

  // Fetch seat config for entry_class
  const { data: config } = await supabaseAdmin
    .from('rte_seat_config').select('entry_class')
    .eq('school_id', schoolId).eq('academic_year_id', app.academic_year_id).maybeSingle();

  const yearLabel = (Array.isArray(app.academic_years) ? app.academic_years[0] : app.academic_years as { label?: string } | null)?.label ?? new Date().getFullYear().toString();
  const slug = school?.slug ?? 'school';
  const yearShort = yearLabel.replace('-', '').slice(0, 4);
  const certNumber = `RTE-${slug.toUpperCase().slice(0,6)}-${yearShort}-${String(app.lottery_number ?? 0).padStart(3,'0')}`;

  const certContent = generateCertContent({
    schoolName: school?.name ?? 'School',
    schoolAddress: school?.address ?? null,
    schoolSlug: slug,
    studentName: app.applicant_name,
    dob: app.date_of_birth,
    category: app.category,
    entryClass: config?.entry_class ?? 'Class 1',
    yearLabel,
    certNumber,
  });

  // Store certificate record
  const { error: certErr } = await supabaseAdmin.from('rte_certificates').insert({
    school_id: schoolId,
    student_id: app.student_id,
    rte_application_id: application_id,
    certificate_number: certNumber,
    academic_year_id: app.academic_year_id,
    issued_by: staffId ?? null,
    pdf_content: certContent,
  });
  if (certErr) return NextResponse.json({ error: certErr.message }, { status: 500 });

  return NextResponse.json({ certificate_number: certNumber, pdf_data: certContent }, { status: 201 });
}
