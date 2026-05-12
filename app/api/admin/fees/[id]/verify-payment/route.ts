// app/api/admin/fees/[id]/verify-payment/route.ts
// Item #13 — Hybrid Fee Collection: Mode C admin-side verification.
//
// PATCH /api/admin/fees/:id/verify-payment
//
// Admin reviews a fee that is in status=pending_verification (parent submitted
// payment proof via POST /api/parent/fees/:id/submit-payment-proof).
//
// Auth: requireAdminSession (owner | principal | admin_staff | accountant)
// Institution gate: fee_module_enabled
//
// Body:
//   approved: boolean  (required) — true = mark paid, false = reject (revert to pending)
//   notes?:   string   — optional review note
//
// On approved=true: status → 'paid', payment_verified_by, payment_verified_at
// On approved=false: status → 'pending', clears payment_screenshot_url / payment_reference
//   (parent can re-submit after correction)
//
// Idempotent: returns 409 if fee is already paid/waived.
//
// TODO(item-15): migrate to supabaseForUser when service-role audit lands.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

interface VerifyBody {
  approved: boolean;
  notes?: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidBody(b: unknown): b is VerifyBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.approved === 'boolean' &&
    (o.notes === undefined || (typeof o.notes === 'string' && o.notes.length <= 1000))
  );
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
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
  const feeId = params.id;
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
      { error: 'Body must include approved (boolean); optional: notes (string ≤1000 chars)' },
      { status: 400 }
    );
  }

  // Fetch fee
  const { data: fee, error: lookupErr } = await supabaseAdmin
    .from('fees')
    .select('id, status, payment_screenshot_url, payment_reference')
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  if (fee.status === 'paid' || fee.status === 'waived') {
    return NextResponse.json({ error: `Fee is already ${fee.status}` }, { status: 409 });
  }
  if (fee.status !== 'pending_verification') {
    return NextResponse.json(
      { error: `Fee is in status '${fee.status}' — only pending_verification fees can be verified` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  let updatePayload: Record<string, unknown>;

  if (body.approved) {
    updatePayload = {
      status: 'paid',
      paid_date: todayIST(),
      payment_verified_by: staffId ?? userId,
      payment_verified_at: now,
    };
  } else {
    // Reject: revert to pending so parent can re-submit
    updatePayload = {
      status: 'pending',
      payment_screenshot_url: null,
      payment_reference: null,
    };
  }

  const { data, error: updateErr } = await supabaseAdmin
    .from('fees')
    .update(updatePayload)
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .select('id, status, paid_date, payment_verified_at')
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    fee: data,
    action: body.approved ? 'approved' : 'rejected',
    ...(body.notes ? { notes: body.notes } : {}),
  });
}
