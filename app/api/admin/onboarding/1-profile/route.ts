// app/api/admin/onboarding/1-profile/route.ts
// Onboarding Step 1: School profile (name, address, board, type, phone, logo URL, lat, lng)
// Updates both schools and institutions tables.
// PR-2: lat/lng additive — populates schools.lat/lng for K6 GPS geofence trigger.
//       If unsupplied or invalid, columns remain NULL (K6 falls through to en_route).
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function parseCoord(raw: unknown, kind: 'lat' | 'lng'): number | null | 'invalid' {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 'invalid';
  if (kind === 'lat' && (n < -90 || n > 90)) return 'invalid';
  if (kind === 'lng' && (n < -180 || n > 180)) return 'invalid';
  return n;
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name, address, board, institution_type, ownership_type, phone, logo_url } = body as Record<string, string>;
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // PR-2: parse + validate lat/lng. Optional — null is fine.
  const lat = parseCoord(body.lat, 'lat');
  const lng = parseCoord(body.lng, 'lng');
  if (lat === 'invalid') return NextResponse.json({ error: 'lat must be a number between -90 and 90' }, { status: 400 });
  if (lng === 'invalid') return NextResponse.json({ error: 'lng must be a number between -180 and 180' }, { status: 400 });

  // Build updates. Only include lat/lng keys when the request supplied them
  // (treating "field not in body" as "don't change", vs. "explicit null" as "clear").
  const schoolUpdates: Record<string, unknown> = {
    name: name.trim(),
    address: address?.trim() ?? null,
    board: board?.trim() ?? null,
    contact_phone: phone?.trim() ?? null,
    logo_url: logo_url?.trim() ?? null,
  };
  if ('lat' in body) schoolUpdates.lat = lat;
  if ('lng' in body) schoolUpdates.lng = lng;

  const { error: sErr } = await supabaseAdmin.from('schools').update(schoolUpdates).eq('id', schoolId);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Update institutions table via school's institution_id (no lat/lng on institutions).
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
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

  return NextResponse.json({ success: true, step: 1, lat, lng });
}
