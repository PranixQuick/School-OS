// app/api/admin/fees/[id]/mark-paid/route.ts
// Item #13 — Hybrid Fee Collection: Mode B (cash/cheque/other) + waiver admin action.
//
// PATCH /api/admin/fees/:id/mark-paid
//
// Auth: requireAdminSession (owner | principal | admin_staff | accountant)
// Institution gate: fee_module_enabled must be true in institutions.feature_flags
//
// Body:
//   method:           'cash' | 'cheque' | 'waiver' | 'other'  (required)
//   reference?:       string  — cheque number, transfer ref, etc.
//   discount_amount?: number  — applied discount (waiver path)
//   discount_reason?: string  — required when discount_amount > 0
//
// On success:
//   - method=waiver:  status → 'waived', discount fields written
//   - all others:     status → 'paid', payment_method/reference/verified_by/verified_at written
//   - paid_date set to today (IST) in both cases
//
// Idempotent: if fee already paid/waived, returns 409.
//
// TODO(item-15): migrate to supabaseForUser when service-role audit lands.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const ALLOWED_METHODS = ['cash', 'cheque', 'waiver', 'other'] as const;
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
  const { schoolId, staffId, userId } = ctx;

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
      { error: 'Body must include method (cash|cheque|waiver|other); optional: reference, discount_amount, discount_reason' },
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
    .select('id, status, amount, student_id')
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  if (fee.status === 'paid' || fee.status === 'waived') {
    return NextResponse.json(
      { error: `Fee is already ${fee.status}` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const today = todayIST();
  const isWaiver = body.method === 'waiver';

  const updatePayload: Record<string, unknown> = {
    status: isWaiver ? 'waived' : 'paid',
    paid_date: today,
    payment_method: body.method,
    payment_reference: body.reference ?? null,
    payment_verified_by: staffId ?? userId,
    payment_verified_at: now,
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
  return NextResponse.json({ fee: data });
}
