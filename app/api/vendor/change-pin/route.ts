// app/api/vendor/change-pin/route.ts
// ISS-1 (#1 / P4.6) — Vendor self-service PIN change.
//
// POST { current_pin, new_pin }
//   1. Requires a valid vendor session (cookie).
//   2. Verifies the current PIN against vendors.access_pin_hashed.
//   3. Stores a fresh bcrypt hash.
//
// Additive; no schema change. Mirrors the parent/student change-PIN flow.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireVendorSession, vendorAuthResponse } from '@/lib/vendor-auth';

export const runtime = 'nodejs';

const PIN_RE = /^\d{4,6}$/;

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireVendorSession(req); }
  catch (e) { return vendorAuthResponse(e); }

  let body: { current_pin?: string; new_pin?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const current = (body.current_pin ?? '').trim();
  const next = (body.new_pin ?? '').trim();

  if (!current || !next) {
    return NextResponse.json({ error: 'Current and new PIN are required' }, { status: 400 });
  }
  if (!PIN_RE.test(next)) {
    return NextResponse.json({ error: 'New PIN must be 4 to 6 digits' }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: 'New PIN must be different from the current PIN' }, { status: 400 });
  }

  const { data: vendor, error: selErr } = await supabaseAdmin
    .from('vendors')
    .select('id, access_pin_hashed, is_active, has_portal_access')
    .eq('id', session.vendorId)
    .maybeSingle();

  if (selErr || !vendor) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }
  if (vendor.is_active === false || vendor.has_portal_access === false) {
    return NextResponse.json({ error: 'Portal access is disabled for this account' }, { status: 403 });
  }
  if (!vendor.access_pin_hashed) {
    return NextResponse.json({ error: 'No PIN is set for this account' }, { status: 400 });
  }

  const valid = await bcrypt.compare(current, vendor.access_pin_hashed);
  if (!valid) {
    return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
  }

  const hashed = await bcrypt.hash(next, 10);
  const { error: updErr } = await supabaseAdmin
    .from('vendors')
    .update({ access_pin_hashed: hashed })
    .eq('id', session.vendorId);

  if (updErr) {
    console.error('[vendor change-pin] update failed:', updErr.message);
    return NextResponse.json({ error: 'Could not update PIN. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'PIN updated.' });
}
