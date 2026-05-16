// app/api/admin/onboarding/1-profile/route.ts
// Onboarding Step 1: School profile (name, address, board, type, phone, logo URL, lat, lng)
// Updates both schools and institutions tables.
// PR-2: lat/lng additions populate schools.lat/lng for K6 GPS geofence trigger.
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

// Validate lat/lng numerics or return null. Accepts: number, numeric string,
// '' (treated as null), null, undefined. Rejects out-of-range with explicit error.
function parseLatLng(raw: unknown, label: 'lat' | 'lng'): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Number(raw) : NaN);
  if (!Number.isFinite(n)) return { ok: false, error: label + ' must be a number' };
  if (label === 'lat' && (n < -90 || n > 90)) return { ok: false, error: 'lat must be between -90 and 90' };
  if (label === 'lng' && (n < -180 || n > 180)) return { ok: false, error: 'lng must be between -180 and 180' };
  return { ok: true, value: n };
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdminSession(req);
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name, address, board, institution_type, ownership_type, phone, logo_url } = body as Record<string, string>;

  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // PR-2: parse lat/lng (both optional, both must be valid if provided)
  const latParse = parseLatLng(body.lat, 'lat');
  if (!latParse.ok) return NextResponse.json({ error: latParse.error }, { status: 400 });
  const lngParse = parseLatLng(body.lng, 'lng');
  if (!lngParse.ok) return NextResponse.json({ error: lngParse.error }, { status: 400 });

  const schoolUpdate: Record<string, unknown> = {
    name: name.trim(),
    address: address?.trim() ?? null,
    board: board?.trim() ?? null,
    contact_phone: phone?.trim() ?? null,
    logo_url: logo_url?.trim() ?? null,
  };
  // Only write lat/lng if explicitly provided (don't overwrite with null if absent)
  if ('lat' in body) schoolUpdate.lat = latParse.value;
  if ('lng' in body) schoolUpdate.lng = lngParse.value;

  const { error: sErr } = await supabaseAdmin
    .from('schools')
    .update(schoolUpdate)
    .eq('id', schoolId);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Update institutions table via school's institution_id
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('institution_id')
    .eq('id', schoolId)
    .maybeSingle();
  if (school?.institution_id) {
    await supabaseAdmin.from('institutions').update({
      name: name.trim(),
      address: address?.trim() ?? null,
      board: board?.trim() ?? null,
      contact_phone: phone?.trim() ?? null,
      institution_type: institution_type?.trim() ?? null,
      ownership_type: ownership_type?.trim() ?? null,
    }).eq('id', school.institution_id);
  }

  return NextResponse.json({ success: true, step: 1 });
}
