import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Principal defines a new geofence for their school.
// Auth: session cookie (middleware sets x-school-id header from session).
// Effect: deactivates any current active geofence (sets active_to = NOW()), then
// inserts the new polygon with active_from = NOW(), active_to = NULL.
//
// school_id is sourced from getSchoolId(req) — the session-derived header — never
// from the request body, to prevent cross-tenant injection.

interface DefineRequest {
  polygon_geojson: unknown;
  radius_meters_fallback?: number;
}

// Lightweight GeoJSON Polygon validator.
// Accepts: { type: "Polygon", coordinates: [[ [lng, lat], [lng, lat], ... ]] } with at
// least 4 points (rings should be closed: first point == last point) and lat/lng in range.
function validatePolygon(input: unknown): { ok: true } | { ok: false; reason: string } {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'polygon_geojson must be an object' };
  const g = input as { type?: unknown; coordinates?: unknown };
  if (g.type !== 'Polygon') return { ok: false, reason: 'type must be "Polygon"' };
  if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) {
    return { ok: false, reason: 'coordinates must be a non-empty array' };
  }
  const ring = g.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    return { ok: false, reason: 'outer ring must have at least 4 points (closed)' };
  }
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) return { ok: false, reason: 'each point must be [lng, lat]' };
    const [lng, lat] = pt as [number, number];
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return { ok: false, reason: 'point coordinates must be numeric' };
    }
    if (lat < -90 || lat > 90) return { ok: false, reason: `lat ${lat} out of range` };
    if (lng < -180 || lng > 180) return { ok: false, reason: `lng ${lng} out of range` };
  }
  // Check ring is closed (first == last).
  const first = ring[0] as [number, number];
  const last = ring[ring.length - 1] as [number, number];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return { ok: false, reason: 'outer ring must be closed (first point must equal last point)' };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { polygon_geojson, radius_meters_fallback } = await req.json() as DefineRequest;

    const validation = validatePolygon(polygon_geojson);
    if (!validation.ok) {
      return NextResponse.json({ error: `Invalid polygon: ${validation.reason}` }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Deactivate any current active geofence(s) for this school by setting active_to = NOW().
    // Multiple actives shouldn't exist but the UPDATE is idempotent over zero rows.
    const { error: dErr } = await supabaseAdmin
      .from('school_geofences')
      .update({ active_to: now })
      .eq('school_id', schoolId)
      .is('active_to', null);

    if (dErr) {
      console.error('Geofence deactivate error:', dErr);
      return NextResponse.json({ error: 'Failed to deactivate previous geofence' }, { status: 500 });
    }

    // Insert the new geofence. school_id from session, NOT request body.
    const { data: inserted, error: iErr } = await supabaseAdmin
      .from('school_geofences')
      .insert({
        school_id: schoolId,
        polygon_geojson: polygon_geojson,
        radius_meters_fallback: typeof radius_meters_fallback === 'number' ? radius_meters_fallback : 100,
        active_from: now,
      })
      .select('id, active_from')
      .single();

    if (iErr || !inserted) {
      console.error('Geofence insert error:', iErr);
      return NextResponse.json({ error: 'Failed to create geofence' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      geofence_id: inserted.id,
      active_from: inserted.active_from,
    });

  } catch (err) {
    console.error('Geofence define error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
