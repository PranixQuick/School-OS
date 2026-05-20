// app/api/teacher/geo-checkin/route.ts
// Teacher geo-fenced attendance check-in.
// Point-in-polygon validation against school_geofences.
// Creates teacher_geo_pings row on every check-in.
// Creates teacher_late_events if arrival is after school start time.
// Handles: normal, late, outside-boundary, poor-accuracy, offline-sync.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

// ─── Point-in-polygon (Ray casting) ─────────────────────────────────────────
function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Distance (Haversine) for radius fallback ─────────────────────────────────
function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

interface CheckinBody {
  lat: number;
  lng: number;
  accuracy_m?: number;
  timestamp?: string; // ISO — for offline-synced check-ins
  offline_queued?: boolean;
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: CheckinBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { lat, lng, accuracy_m = 999, timestamp, offline_queued = false } = body;

  if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng required as numbers' }, { status: 400 });
  }

  // Poor accuracy warning (>150m) — still record but flag it
  const poorAccuracy = accuracy_m > 150;

  // Get school geofence
  const { data: geofences } = await supabaseAdmin
    .from('school_geofences')
    .select('id, polygon_geojson, radius_meters_fallback')
    .eq('school_id', session.schoolId)
    .lte('active_from', new Date().toISOString())
    .or(`active_to.is.null,active_to.gt.${new Date().toISOString()}`)
    .limit(1);

  let insidePolygon = false;
  const pingAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  if (geofences && geofences.length > 0) {
    const gf = geofences[0];
    const geojson = gf.polygon_geojson as { type: string; coordinates: number[][][] };

    if (geojson?.type === 'Polygon' && geojson.coordinates?.[0]) {
      // GeoJSON coordinates are [lng, lat] — swap for our lat/lng convention
      const polygon = geojson.coordinates[0].map(([gLng, gLat]) => [gLat, gLng]);
      insidePolygon = pointInPolygon(lat, lng, polygon);
    } else if (gf.radius_meters_fallback) {
      // Fallback: centroid of polygon or use school coordinates
      // Use rough centroid of bounding box as fallback
      const coords = geojson?.coordinates?.[0] ?? [];
      if (coords.length > 0) {
        const centerLat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length;
        const centerLng = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length;
        insidePolygon = distanceM(lat, lng, centerLat, centerLng) <= gf.radius_meters_fallback;
      }
    }
  } else {
    // No geofence configured — accept all check-ins
    insidePolygon = true;
  }

  // Get staff record for this session user
  const { data: staffRow } = await supabaseAdmin
    .from('school_users')
    .select('staff_id')
    .eq('id', session.userId)
    .eq('school_id', session.schoolId)
    .maybeSingle();

  const staffId = staffRow?.staff_id;
  if (!staffId) return NextResponse.json({ error: 'Staff record not found for this account' }, { status: 404 });

  // Insert geo ping
  const { data: pingRow, error: pingErr } = await supabaseAdmin
    .from('teacher_geo_pings')
    .insert({
      school_id: session.schoolId,
      staff_id: staffId,
      ping_at: pingAt,
      lat: lat,
      lng: lng,
      accuracy_m: accuracy_m,
      inside_polygon: insidePolygon,
      raw_retention_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    })
    .select('id')
    .single();

  if (pingErr) {
    console.error('[geo-checkin] ping insert error:', pingErr);
    return NextResponse.json({ error: 'Failed to record check-in' }, { status: 500 });
  }

  // Determine if late (school start = 09:00 local time)
  const checkInTime = new Date(pingAt);
  const hoursIST = (checkInTime.getUTCHours() + 5.5) % 24; // IST offset
  const minutesIST = checkInTime.getUTCMinutes();
  const totalMinutes = hoursIST * 60 + minutesIST;
  const schoolStartMinutes = 9 * 60 + 0; // 09:00
  const gracePeriodMinutes = 10; // 09:10 grace
  const isLate = totalMinutes > schoolStartMinutes + gracePeriodMinutes;
  const deltaMinutes = isLate ? totalMinutes - schoolStartMinutes : 0;

  // Create late event if late and inside compound
  if (isLate && insidePolygon) {
    await supabaseAdmin.from('teacher_late_events').insert({
      school_id: session.schoolId,
      staff_id: staffId,
      scheduled_period_id: null, // no timetable period needed for daily late tracking
      expected_at: new Date(new Date(pingAt).setHours(9, 0, 0, 0)).toISOString(),
      first_present_at: pingAt,
      delta_minutes: deltaMinutes,
      strike_count: 1,
    }).single();
  }

  // Build response
  let status: 'on_time' | 'late' | 'outside_boundary' | 'poor_accuracy' | 'no_fence';
  if (!geofences?.length) status = 'no_fence';
  else if (poorAccuracy) status = 'poor_accuracy';
  else if (!insidePolygon) status = 'outside_boundary';
  else if (isLate) status = 'late';
  else status = 'on_time';

  const messages: Record<typeof status, string> = {
    on_time: 'హాజరు నమోదైంది! ✅ సమయానికి వచ్చారు',
    late: `హాజరు నమోదైంది ⏰ ఆలస్యం: ${deltaMinutes} నిమిషాలు`,
    outside_boundary: 'హాజరు నమోదైంది ⚠️ పాఠశాల సీమ వెలుపల',
    poor_accuracy: 'హాజరు నమోదైంది ⚠️ GPS accuracy తక్కువ — మళ్ళీ ప్రయత్నించండి',
    no_fence: 'హాజరు నమోదైంది ✅',
  };

  return NextResponse.json({
    success: true,
    ping_id: pingRow?.id,
    status,
    inside_polygon: insidePolygon,
    delta_minutes: deltaMinutes,
    is_late: isLate,
    poor_accuracy: poorAccuracy,
    offline_synced: offline_queued,
    message: messages[status],
    check_in_time: pingAt,
  });
}
