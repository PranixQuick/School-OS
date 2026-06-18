// app/api/vendor/me/route.ts
// ISS-7 (#7) — Logged-in vendor's own profile.
// GET: profile + contract. PATCH: update own contact details only.

import { NextRequest, NextResponse } from 'next/server';
import { requireVendorSession, vendorAuthResponse } from '@/lib/vendor-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const PROFILE_COLS = 'id, name, vendor_type, contact_name, contact_phone, contact_email, gst_number, address, contract_start, contract_end, portal_email';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireVendorSession(req); }
  catch (e) { return vendorAuthResponse(e); }

  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select(PROFILE_COLS)
    .eq('id', session.vendorId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  return NextResponse.json({ vendor: data });
}

export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireVendorSession(req); }
  catch (e) { return vendorAuthResponse(e); }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // v1: vendors may update only their own contact details.
  const update: Record<string, unknown> = {};
  if (typeof body.contact_name === 'string') update.contact_name = body.contact_name.trim() || null;
  if (typeof body.contact_phone === 'string') update.contact_phone = body.contact_phone.trim() || null;
  if (typeof body.contact_email === 'string') update.contact_email = body.contact_email.trim() || null;

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('vendors')
    .update(update)
    .eq('id', session.vendorId)   // scoped to the logged-in vendor only
    .select(PROFILE_COLS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  return NextResponse.json({ vendor: data });
}
