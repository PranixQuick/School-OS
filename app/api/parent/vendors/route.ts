// app/api/parent/vendors/route.ts
// ISS-7 (#7) — Parent-facing vendor visibility.
// Returns the school's active vendors that are relevant to parents
// (transport, books, uniform, food) with contact details. Internal vendor
// types (security/it/maintenance/stationery/other) are not surfaced to parents.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

const PARENT_FACING = ['transport', 'books', 'uniform', 'food'];

async function resolveParent(req: NextRequest): Promise<{ schoolId: string } | null> {
  const session = await getParentSession(req);
  if (session) return { schoolId: session.schoolId };

  let body: { phone?: string; pin?: string } = {};
  try { body = await req.json(); } catch { return null; }
  const { phone, pin } = body;
  if (!phone || !pin) return null;

  const { data: parents } = await supabaseAdmin.from('parents')
    .select('id, school_id, access_pin, access_pin_hashed')
    .eq('phone', phone);
  if (!parents || parents.length !== 1) return null;
  const p = parents[0];

  let valid = false;
  if (p.access_pin_hashed) valid = await bcrypt.compare(pin, p.access_pin_hashed);
  else if (p.access_pin) valid = p.access_pin === pin;
  if (!valid) return null;

  return { schoolId: p.school_id };
}

export async function GET(req: NextRequest) {
  const parent = await resolveParent(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', parent.schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ vendors: [] });

  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('id, name, vendor_type, contact_name, contact_phone, contact_email')
    .eq('institution_id', school.institution_id)
    .eq('is_active', true)
    .in('vendor_type', PARENT_FACING)
    .order('vendor_type', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data ?? [] });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
