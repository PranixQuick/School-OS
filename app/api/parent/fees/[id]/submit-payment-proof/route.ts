// app/api/parent/fees/[id]/submit-payment-proof/route.ts
// Item #13 — Hybrid Fee Collection: Mode C (manual transfer) — parent side.
//
// POST /api/parent/fees/:id/submit-payment-proof
//
// Auth: phone+PIN per request (Item 13 parent auth model).
// Body: { phone, pin, payment_reference: string, screenshot_data_url?: string }
//   payment_reference: required — UPI transaction ID, cheque number, etc.
//   screenshot_data_url: optional — base64 data URL from FileReader
//     TODO(future): wire to Supabase Storage when upload infra is added
//
// Validates fee belongs to parent's student.
// Sets: status=pending_verification, payment_reference, payment_screenshot_url.
// Idempotent: if already pending_verification, overwrites (allows re-submission after rejection).
// Rejects: if already paid/waived.
//
// TODO(item-15): migrate to supabaseForUser when parent auth moves to session model.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isFeeModuleEnabled } from '@/lib/institution-flags';

export const runtime = 'nodejs';

interface ProofBody {
  phone: string;
  pin: string;
  payment_reference: string;
  screenshot_data_url?: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidBody(b: unknown): b is ProofBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.phone === 'string' && o.phone.length > 0 &&
    typeof o.pin === 'string' && o.pin.length > 0 &&
    typeof o.payment_reference === 'string' && o.payment_reference.trim().length > 0 &&
    o.payment_reference.length <= 200 &&
    (o.screenshot_data_url === undefined || typeof o.screenshot_data_url === 'string')
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: feeId } = await params;
  if (!isUuid(feeId)) return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'phone, pin, and payment_reference are required. payment_reference max 200 chars.' },
      { status: 400 }
    );
  }

  // Re-auth parent
  const { data: parents, error: pErr } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id')
    .eq('phone', body.phone)
    .eq('access_pin', body.pin);

  if (pErr) return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 });
  if (!parents || parents.length === 0) return NextResponse.json({ error: 'Invalid phone or PIN' }, { status: 401 });
  if (parents.length > 1) return NextResponse.json({ error: 'Multiple accounts match this phone. Contact school admin.' }, { status: 409 });

  const { school_id: schoolId, student_id: studentId } = parents[0];

  // Institution gate
  const feeEnabled = await isFeeModuleEnabled(schoolId);
  if (!feeEnabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  // Fetch fee — must belong to this parent's student in this school
  const { data: fee, error: lookupErr } = await supabaseAdmin
    .from('fees')
    .select('id, status, student_id')
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!fee) return NextResponse.json({ error: 'Fee not found or does not belong to your student' }, { status: 404 });

  if (fee.status === 'paid' || fee.status === 'waived') {
    return NextResponse.json({ error: `Fee is already ${fee.status}` }, { status: 409 });
  }

  // Truncate screenshot_data_url to avoid absurdly large payloads
  // (base64 image ~200KB → ~270KB string; truncate at 500KB of characters)
  const screenshotUrl = body.screenshot_data_url
    ? body.screenshot_data_url.slice(0, 500_000)
    : null;

  const { data, error: updateErr } = await supabaseAdmin
    .from('fees')
    .update({
      status: 'pending_verification',
      payment_reference: body.payment_reference.trim(),
      payment_screenshot_url: screenshotUrl,
    })
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .select('id, status, payment_reference')
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ success: true, status: 'pending_verification', fee: data });
}
