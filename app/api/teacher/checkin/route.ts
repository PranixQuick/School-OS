// app/api/teacher/checkin/route.ts
// Item #1 Track C Phase 3 — Geo check-in.
//
// POST /api/teacher/checkin — record a geo ping and (if first of day) set
// teacher_attendance row to 'present'.
//
// Body: { lat: number, lng: number, accuracy_m?: number }
//
// Defense-in-depth model per master decision OPTION_B_SUPABASE_ADMIN_WITH_EXPLICIT_SCOPING:
//   1. requireTeacherSession resolves staff_id from session.userId via school_users
//   2. Every insert uses .eq('staff_id', ctx.staffId).eq('school_id', ctx.schoolId)
//   3. RLS additive policies (auth_write_teacher_geo) provide safety net
//
// TODO(item-15): migrate to supabaseForUser(accessToken) when Item #15 service-role
// audit lands. supabaseAdmin is the documented staged-rollout fallback per
// lib/supabaseClient.ts.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// IST day helper — used to scope teacher_attendance row by local date
function istTodayISO(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
}

function istTimeISO(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  return `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}:${String(ist.getUTCSeconds()).padStart(2, '0')}`;
}

// Haversine — meters between two lat/lng points
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface CheckinBody {
  lat: number;
  lng: number;
  accuracy_m?: number;
}

function isValidBody(b: unknown): b is CheckinBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.lat === 'number' && o.lat >= -90 && o.lat <= 90 &&
    typeof o.lng === 'number' && o.lng >= -180 && o.lng <= 180 &&
    (o.accuracy_m === undefined || typeof o.accuracy_m === 'number')
  );
}

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireTeacherSession(req);
  } catch (e) {
    if (e instanceof TeacherAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const { staffId, schoolId } = ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'Body must include numeric lat (-90..90) and lng (-180..180)' }, { status: 400 });
  }
  const { lat, lng, accuracy_m } = body;

  // Look up the school's geofence to compute inside_polygon. If no geofence
  // configured yet (pre-customer mode), we still record the ping but mark
  // inside_polygon = null so the analytics layer can distinguish "outside" from
  // "unknown".
  const { data: geofence } = await supabaseAdmin
    .from('school_geofences')
    .select('polygon_geojson, radius_meters_fallback')
    .eq('school_id', schoolId)
    .maybeSingle();

  let insidePolygon: boolean | null = null;
  if (geofence) {
    // If a circular fallback is configured AND has a center, use radius.
    // Polygon checks (PIP) are deferred — for v1, a missing/invalid polygon
    // and missing radius means inside_polygon stays null.
    const fence = geofence.polygon_geojson as { center?: { lat: number; lng: number } } | null;
    if (fence?.center && geofence.radius_meters_fallback) {
      const d = distanceMeters(fence.center.lat, fence.center.lng, lat, lng);
      insidePolygon = d <= geofence.radius_meters_fallback;
    }
  }

  // Insert the ping (RLS: auth_write_teacher_geo policy gates this)
  const { error: pingErr } = await supabaseAdmin
    .from('teacher_geo_pings')
    .insert({
      school_id: schoolId,
      staff_id: staffId,
      ping_at: new Date().toISOString(),
      lat,
      lng,
      accuracy_m: accuracy_m ?? null,
      inside_polygon: insidePolygon,
    });
  if (pingErr) {
    return NextResponse.json({ error: pingErr.message }, { status: 500 });
  }

  // Upsert teacher_attendance for today if not already 'present'
  const today = istTodayISO();
  const { data: existingAtt } = await supabaseAdmin
    .from('teacher_attendance')
    .select('id, status')
    .eq('staff_id', staffId)
    .eq('school_id', schoolId)
    .eq('date', today)
    .maybeSingle();

  if (!existingAtt) {
    const { error: attErr } = await supabaseAdmin
      .from('teacher_attendance')
      .insert({
        school_id: schoolId,
        staff_id: staffId,
        date: today,
        status: 'present',
        check_in_time: istTimeISO(),
        marked_via: 'geo_checkin',
      });
    if (attErr && !attErr.message.includes('duplicate')) {
      // Don't fail the checkin if attendance write fails; the ping is the source of truth
      console.warn('teacher_attendance insert failed:', attErr.message);
    }
  }

  return NextResponse.json({
    ok: true,
    inside_polygon: insidePolygon,
    geofence_configured: geofence !== null,
    today,
  });
}
