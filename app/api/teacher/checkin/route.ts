import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { writeNotification } from '@/lib/notifications';

// Teacher geo check-in. Phone+PIN auth (mirrors /api/teacher/login pattern).
//
// Flow:
//   1. Re-verify teacher by phone+PIN
//   2. Fetch active geofence for teacher's school (school_id from authenticated record)
//   3. Server-side point-in-polygon test on submitted lat/lng
//   4. INSERT teacher_geo_pings row with inside_polygon flag
//   5. If conditions met (scheduled now AND outside polygon AND >15min late AND no
//      existing late_event for this teacher+period today), INSERT teacher_late_events row
//   6. Return {inside, polygon_active, late_event_logged}
//
// Coordinates are NEVER trusted from client for authorization purposes — only used as
// the input to the polygon test. school_id is always sourced from the authenticated
// staff record, never from the request body.

interface CheckinRequest {
  phone: string;
  pin: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
}

// GeoJSON polygon: { type: "Polygon", coordinates: [[ [lng, lat], [lng, lat], ... ]] }
// Note GeoJSON uses [lng, lat] order, NOT [lat, lng]. Ray-casting needs to be careful.
function pointInPolygon(lat: number, lng: number, geojson: unknown): boolean {
  if (!geojson || typeof geojson !== 'object') return false;
  const g = geojson as { type?: string; coordinates?: unknown };
  if (g.type !== 'Polygon' || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return false;
  const ring = g.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i] as [number, number]; // [lng, lat]
    const pj = ring[j] as [number, number];
    const lngI = pi[0], latI = pi[1];
    const lngJ = pj[0], latJ = pj[1];
    const intersect = ((lngI > lng) !== (lngJ > lng))
      && (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI);
    if (intersect) inside = !inside;
  }
  return inside;
}

// IST-explicit "now" helper. Server runs in UTC (Vercel iad1) but timetable.start_time
// is wall-clock IST. Returns IST date string, IST time string, and IST day-of-week.
function nowInIST(): { dateStr: string; timeStr: string; dow: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const timeStr = `${get('hour')}:${get('minute')}:${get('second')}`;
  const dowName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', weekday: 'short',
  }).format(now);
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dowName);
  return { dateStr, timeStr, dow };
}

export async function POST(req: NextRequest) {
  try {
    const { phone, pin, lat, lng, accuracy_m } = await req.json() as CheckinRequest;

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng required (numeric)' }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'lat/lng out of valid range' }, { status: 400 });
    }

    // Re-auth teacher.
    const { data: teacher, error: tErr } = await supabaseAdmin
      .from('staff')
      .select('id, school_id, name')
      .eq('phone', phone)
      .eq('access_pin', pin)
      .eq('is_active', true)
      .single();

    if (tErr || !teacher) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    // Fetch active geofence for teacher's school.
    // "Active" = active_from <= NOW() AND active_to IS NULL (current and not superseded).
    const { data: geofence, error: gErr } = await supabaseAdmin
      .from('school_geofences')
      .select('id, polygon_geojson')
      .eq('school_id', teacher.school_id)
      .is('active_to', null)
      .lte('active_from', new Date().toISOString())
      .order('active_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (gErr) {
      console.error('Geofence fetch error:', gErr);
      return NextResponse.json({ error: 'Failed to fetch geofence' }, { status: 500 });
    }

    const polygonActive = !!geofence;
    const inside = polygonActive ? pointInPolygon(lat, lng, geofence!.polygon_geojson) : false;

    // Write the ping. school_id from authenticated teacher (NOT from request body).
    const { error: pErr } = await supabaseAdmin
      .from('teacher_geo_pings')
      .insert({
        school_id: teacher.school_id,
        staff_id: teacher.id,
        lat,
        lng,
        accuracy_m: typeof accuracy_m === 'number' ? accuracy_m : null,
        inside_polygon: polygonActive ? inside : null,
      });

    if (pErr) {
      console.error('Geo ping insert error:', pErr);
      return NextResponse.json({ error: 'Failed to record check-in' }, { status: 500 });
    }

    // Conditional late-event logic.
    // Find timetable row for THIS teacher today (IST) where start_time <= NOW_IST.
    // If found AND NOT inside_polygon AND NOW > start_time + 15min AND still in window
    // (NOW <= end_time + 15min) AND no existing late_event for this teacher+period today,
    // INSERT teacher_late_events.
    let lateEventLogged = false;
    if (polygonActive && !inside) {
      const { dateStr: today, timeStr: nowTime, dow } = nowInIST();
      const now = new Date();

      // Half-open interval bounds for "today" in IST: [today 00:00 IST, tomorrow 00:00 IST).
      const tomorrowDate = new Date(new Date(`${today}T00:00:00+05:30`).getTime() + 86400000);
      const tomorrowStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(tomorrowDate);

      const { data: scheduled, error: sErr } = await supabaseAdmin
        .from('timetable')
        .select('id, period, start_time, end_time')
        .eq('staff_id', teacher.id)
        .eq('school_id', teacher.school_id)
        .eq('day_of_week', dow)
        .lte('start_time', nowTime)
        .order('start_time', { ascending: false })
        .limit(1);

      if (sErr) {
        console.error('Timetable lookup for late-event error:', sErr);
        // Non-fatal: ping is already saved. Just skip the late-event side effect.
      } else if (scheduled && scheduled.length > 0) {
        const t = scheduled[0];
        // Compute expected_at = today + start_time as TIMESTAMPTZ in IST.
        const expectedAt = new Date(`${today}T${t.start_time}+05:30`);
        const deltaMinutes = Math.floor((now.getTime() - expectedAt.getTime()) / 60000);

        // Only log if currently >15min past start AND still within end_time + 15min grace.
        const endPlus15 = new Date(`${today}T${t.end_time}+05:30`).getTime() + 15 * 60000;
        const inWindow = now.getTime() <= endPlus15;

        if (deltaMinutes > 15 && inWindow) {
          // Idempotency: skip if a late_event already exists for this teacher today for this period.
          const { count: existingCount } = await supabaseAdmin
            .from('teacher_late_events')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', teacher.school_id)
            .eq('staff_id', teacher.id)
            .eq('scheduled_period_id', t.id)
            .gte('expected_at', `${today}T00:00:00+05:30`)
            .lt('expected_at', `${tomorrowStr}T00:00:00+05:30`);

          if (!existingCount || existingCount === 0) {
            // Item 14a (Spawn 7 #H): capture inserted row id via .select('id').single()
            // so notification reference_id can link back to the source event.
            const { data: lateEventRow, error: leErr } = await supabaseAdmin
              .from('teacher_late_events')
              .insert({
                school_id: teacher.school_id,
                staff_id: teacher.id,
                scheduled_period_id: t.id,
                expected_at: expectedAt.toISOString(),
                delta_minutes: deltaMinutes,
                strike_count: 1,
              })
              .select('id')
              .single();
            if (!leErr && lateEventRow) {
              lateEventLogged = true;
              // Item 14a: Best-effort notification write. Failure is non-fatal.
              try {
                const notifResult = await writeNotification(supabaseAdmin, {
                  school_id: teacher.school_id,
                  type: 'risk',
                  title: 'Teacher arrived late',
                  message: `${teacher.name} arrived ${deltaMinutes} min late for period ${t.period}.`,
                  module: 'teacher_late',
                  reference_id: lateEventRow.id,
                });
                if (!notifResult.ok) {
                  console.error('Notification write failed (non-fatal):', notifResult.error);
                }
              } catch (notifErr) {
                console.error('Notification write threw (non-fatal):', notifErr);
              }
            } else if (leErr) {
              console.error('Late event insert error:', leErr);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      inside,
      polygon_active: polygonActive,
      late_event_logged: lateEventLogged,
    });

  } catch (err) {
    console.error('Teacher checkin error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
