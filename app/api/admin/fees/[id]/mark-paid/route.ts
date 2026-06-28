// app/api/admin/fees/[id]/mark-paid/route.ts
// Item #13 — Hybrid Fee Collection: record how a fee was settled (the institution collects
// the money directly — EdProSys never holds funds), plus the waiver admin action.
//
// PATCH /api/admin/fees/:id/mark-paid
//
// Auth: requireAdminSession (owner | principal | admin_staff | admin | accountant)
// Institution gate: fee_module_enabled must be true in institutions.feature_flags
//
// Body:
//   method: 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'waiver' | 'other'  (required)
//   reference?: string  — cheque number, UPI ref, NEFT/IMPS ref, etc.
//   discount_amount?: number  — applied discount (waiver path)
//   discount_reason?: string  — required when discount_amount > 0
//
// On success:
//   - method=waiver: status → 'waived', discount fields written
//   - all others:    status → 'paid', payment_method/reference/verified_by/verified_at written
//   - paid_date set to today (IST) in both cases
//   - an audit_log row records who settled it, how, and (for waivers) why
//
// Idempotent: if fee already paid/waived, returns 409.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { writeNotification } from '@/lib/notifications'; // Item #14 PR #2
import { allocateReceiptNumber } from '@/lib/receipt'; // Fees: receipt numbering

export const runtime = 'nodejs';

// Modes the institution can record. All are "money handled by the institution directly".
// 'waiver' writes off the balance; 'online' is reserved for the gateway flow (parent app).
const ALLOWED_METHODS = ['cash', 'cheque', 'bank_transfer', 'upi', 'waiver', 'other'] as const;
type PayMethod = (typeof ALLOWED_METHODS)[number];

interface MarkPaidBody {
  method: PayMethod;
  reference?: string;
  discount_amount?: number;
  discount_reason?: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidBody(b: unknown): b is MarkPaidBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  if (!o.method || !(ALLOWED_METHODS as readonly string[]).includes(o.method as string)) return false;
  if (o.reference !== undefined && (typeof o.reference !== 'string' || o.reference.length > 500)) return false;
  if (o.discount_amount !== undefined && (typeof o.discount_amount !== 'number' || o.discount_amount < 0)) return false;
  if (o.discount_reason !== undefined && typeof o.discount_reason !== 'string') return false;
  return true;
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, staffId, userId, userRole } = ctx;

  // Param validation
  const { id: feeId } = await params;
  if (!isUuid(feeId)) return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });

  // Institution gate
  const feeEnabled = await isFeeModuleEnabled(schoolId);
  if (!feeEnabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  // Body
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Body must include method (cash|cheque|bank_transfer|upi|waiver|other); optional: reference, discount_amount, discount_reason' },
      { status: 400 }
    );
  }

  // Validate discount fields
  if (body.method === 'waiver' && !body.discount_reason) {
    return NextResponse.json({ error: 'discount_reason is required for waivers' }, { status: 400 });
  }
  if ((body.discount_amount ?? 0) > 0 && !body.discount_reason) {
    return NextResponse.json({ error: 'discount_reason required when discount_amount > 0' }, { status: 400 });
  }

  // Fetch fee — must belong to this school
  const { data: fee, error: lookupErr } = await supabaseAdmin
    .from('fees')
    .select('id, status, amount, student_id, payment_method, payment_reference, is_deleted')
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!fee || fee.is_deleted) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  if (fee.status === 'paid' || fee.status === 'waived') {
    return NextResponse.json(
      { error: `Fee is already ${fee.status}` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const today = todayIST();
  const isWaiver = body.method === 'waiver';

  // Fees: allocate a receipt number for money-collected settlements (not waivers). Fail-closed.
  let receiptNumber: string | null = null;
  if (!isWaiver) {
    receiptNumber = await allocateReceiptNumber(schoolId);
    if (!receiptNumber) {
      return NextResponse.json(
        { error: 'Could not allocate receipt number; fee was not marked paid. Please retry.' },
        { status: 500 }
      );
    }
  }

  const updatePayload: Record<string, unknown> = {
    status: isWaiver ? 'waived' : 'paid',
    paid_date: today,
    payment_method: body.method,
    payment_reference: body.reference ?? null,
    payment_verified_by: staffId,
    payment_verified_at: now,
    fee_receipt_number: receiptNumber,
  };

  if (isWaiver || (body.discount_amount ?? 0) > 0) {
    updatePayload.discount_amount = body.discount_amount ?? fee.amount;
    updatePayload.discount_reason = body.discount_reason ?? null;
    updatePayload.discount_approved_by = staffId ?? userId;
    if (!updatePayload.original_amount) updatePayload.original_amount = fee.amount;
  }

  const { data, error: updateErr } = await supabaseAdmin
    .from('fees')
    .update(updatePayload)
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .select('id, status, paid_date, payment_method, payment_reference, payment_verified_at')
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Audit: who settled this fee, how, and (for waivers) why.
  try {
    await supabaseAdmin.from('audit_log').insert({
      school_id: schoolId,
      user_id: userId ?? null,
      action: isWaiver ? 'fee.waive' : 'fee.mark_paid',
      op: 'UPDATE',
      resource: 'fees',
      resource_id: feeId,
      old_data: { status: fee.status, payment_method: fee.payment_method, payment_reference: fee.payment_reference },
      new_data: data,
      metadata: {
        method: body.method,
        reference: body.reference ?? null,
        discount_amount: body.discount_amount ?? null,
        discount_reason: body.discount_reason ?? null,
        by_role: userRole, by_staff: staffId ?? null,
      },
      ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
      user_agent: req.headers.get('user-agent') ?? null,
    });
  } catch (auditErr) { console.error('[mark-paid] audit_log write failed (non-fatal):', auditErr); }

  // Item #14 PR #2: best-effort notification on payment confirmed
  if (!isWaiver) {
    try {
      // Fetch student name for the message
      const { data: studentRow } = await supabaseAdmin
        .from('students').select('name')
        .eq('id', fee.student_id).eq('school_id', schoolId).maybeSingle();
      const studentName = studentRow?.name ?? 'student';
      const receiptRef = data.payment_reference ?? '—';
      await writeNotification(supabaseAdmin, {
        school_id: schoolId,
        type: 'fee_reminder',
        title: 'Fee payment confirmed',
        message: `Payment of ₹${Math.round(Number(fee.amount))} for ${studentName} confirmed. Receipt: ${receiptRef}.`,
        module: 'fees',
        reference_id: feeId,
      });
    } catch (notifErr) { console.error('[mark-paid] notification hook failed (non-fatal):', notifErr); }
  }

  return NextResponse.json({ fee: data });
}
