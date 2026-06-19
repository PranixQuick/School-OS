// app/api/parent/change-pin/route.ts
// ISS-1 (#1 / P4.6) — Parent self-service PIN change.
//
// POST { current_pin, new_pin }
//   1. Requires a valid parent session (cookie).
//   2. Re-verifies the current PIN via the shared verifyParentCredentials
//      (same path as parent login; transparently handles legacy plaintext).
//   3. Stores a fresh bcrypt hash and clears any legacy plaintext PIN.
//
// Additive; no schema change. Mirrors the staff change-password flow.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession, verifyParentCredentials } from '@/lib/parent-auth';

export const runtime = 'nodejs';

const PIN_RE = /^\d{4,6}$/;

export async function POST(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

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

  // Verify the current PIN (same logic as login).
  let verified;
  try { verified = await verifyParentCredentials(session.phone, current); }
  catch { return NextResponse.json({ error: 'Could not verify current PIN' }, { status: 500 }); }

  if (!verified || verified.id !== session.parentId) {
    return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
  }

  const hashed = await bcrypt.hash(next, 10);
  const { error } = await supabaseAdmin
    .from('parents')
    .update({ access_pin_hashed: hashed, access_pin: null })
    .eq('id', session.parentId);

  if (error) {
    console.error('[parent change-pin] update failed:', error.message);
    return NextResponse.json({ error: 'Could not update PIN. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'PIN updated.' });
}
