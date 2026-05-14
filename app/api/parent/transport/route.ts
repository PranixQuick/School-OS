// app/api/parent/transport/route.ts
// Batch 4F — Parent transport info: route, driver, stop, today trip status.
// Stateless — phone+PIN per-request, matching /api/parent/login pattern.
// TODO(item-15)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get('phone');
  const pin = searchParams.get('pin');
  if (!phone || !pin) return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });

  // Verify parent — plain-text PIN matching /api/parent/login pattern
  const { data: parents } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id, name')
    .eq('phone', phone)
    .eq('access_pin', pin);

  if (!parents?.length) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  if (parents.length > 1) return NextResponse.json({ error: 'Multiple accounts. Contact school.' }, { status: 409 });
  const parent = parents[0];

  // Fetch student transport assignment
  const { data: assignment } = await supabaseAdmin
    .from('student_transport')
    .select('*, transport_routes(route_name, route_number, driver_name, driver_phone, vehicle_reg), transport_stops(stop_name, pickup_time, dropoff_time, landmark, stop_order)')
    .eq('student_id', parent.student_id)
    .eq('school_id', parent.school_id)
    .eq('opted_in', true)
    .maybeSingle();

  if (!assignment) return NextResponse.json({ transport: null, message: 'Student is not assigned to any transport route.' });

  const route = Array.isArray(assignment.transport_routes) ? assignment.transport_routes[0] : assignment.transport_routes as { route_name?: string; route_number?: string; driver_name?: string; driver_phone?: string; vehicle_reg?: string } | null;
  const stop = Array.isArray(assignment.transport_stops) ? assignment.transport_stops[0] : assignment.transport_stops as { stop_name?: string; pickup_time?: string; dropoff_time?: string; landmark?: string } | null;

  // Today's trip status
  const today = new Date().toISOString().slice(0, 10);
  const { data: trips } = await supabaseAdmin
    .from('transport_trips')
    .select('id, trip_type, status, started_at, completed_at')
    .eq('school_id', parent.school_id)
    .eq('route_id', assignment.route_id)
    .eq('trip_date', today)
    .order('created_at', { ascending: false });

  const todayTrips = trips ?? [];
  const pickupTrip = todayTrips.find(t => t.trip_type === 'pickup');
  const dropoffTrip = todayTrips.find(t => t.trip_type === 'dropoff');

  return NextResponse.json({
    transport: {
      route_name: route?.route_name ?? '—',
      route_number: route?.route_number,
      driver_name: route?.driver_name,
      driver_phone: route?.driver_phone,
      vehicle_reg: route?.vehicle_reg,
      stop_name: stop?.stop_name ?? '—',
      pickup_time: stop?.pickup_time,
      dropoff_time: stop?.dropoff_time,
      landmark: stop?.landmark,
    },
    today: {
      pickup: pickupTrip ? { status: pickupTrip.status, started_at: pickupTrip.started_at } : null,
      dropoff: dropoffTrip ? { status: dropoffTrip.status, completed_at: dropoffTrip.completed_at } : null,
    },
  });
}
