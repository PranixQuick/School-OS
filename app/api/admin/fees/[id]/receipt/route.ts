// app/api/admin/fees/[id]/receipt/route.ts
// Read-only receipt payload for the print page app/admin/fees/receipt/[id]/page.tsx.
// Assembles fee + student + school into the exact { receipt: {...} } shape the page
// reads. No new tables, no schema change, no redesign. Mirrors the auth + async-param
// pattern of the sibling /api/admin/fees/[id]/* routes (mark-paid, refund, …).
//
// GET /api/admin/fees/:id/receipt
// Auth: requireAdminSession (owner | principal | admin_staff | accountant | …)
// Institution gate: fee_module_enabled

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface StudentLite {
  name?: string; class?: string; section?: string;
  roll_number?: string; admission_number?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth — identical pattern to sibling [id] routes
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, userEmail } = ctx;

  const { id: feeId } = await params;
  if (!isUuid(feeId)) return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });

  const feeEnabled = await isFeeModuleEnabled(schoolId);
  if (!feeEnabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  // Fee + student, tenant-scoped to the caller's school
  const { data: fee, error: feeErr } = await supabaseAdmin
    .from('fees')
    .select(`id, amount, original_amount, status, fee_type, description, due_date, paid_date,
             fee_receipt_number, payment_method, payment_reference,
             students:student_id ( name, class, section, roll_number, admission_number )`)
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (feeErr) return NextResponse.json({ error: feeErr.message }, { status: 500 });
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  const student = (Array.isArray(fee.students) ? fee.students[0] : fee.students) as StudentLite | null;

  // School name + address (UDISE not stored — page renders that line only if present)
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('name, address, institution_id')
    .eq('id', schoolId)
    .maybeSingle();

  // Best-effort current academic-year label; page falls back if null
  let academicYear: string | null = null;
  if (school?.institution_id) {
    const { data: ay } = await supabaseAdmin
      .from('academic_years')
      .select('label')
      .eq('institution_id', school.institution_id)
      .eq('is_current', true)
      .maybeSingle();
    academicYear = ay?.label ?? null;
  }

  const amount = Number(fee.amount ?? 0);
  const isSettled = fee.status === 'paid' || fee.status === 'waived';

  const receipt = {
    receipt_number: fee.fee_receipt_number ?? null,
    student_name: student?.name ?? null,
    class: student?.class ?? null,
    section: student?.section ?? null,
    roll_number: student?.roll_number ?? null,
    admission_number: student?.admission_number ?? null,
    fee_type: fee.fee_type ?? 'tuition',
    description: fee.description ?? null,
    amount,
    paid_amount: isSettled ? amount : null,
    balance: isSettled ? 0 : amount,
    payment_date: fee.paid_date ?? null,
    payment_mode: fee.payment_method ?? null,
    academic_year: academicYear,
    school_name: school?.name ?? null,
    school_address: school?.address ?? null,
    issued_by: userEmail ?? null,
  };

  return NextResponse.json({ receipt });
}
