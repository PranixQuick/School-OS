import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// K6: Bus GPS location update endpoint
// PUBLIC PATH — authenticated via device_token (not school session cookie)
// Android GPS app in bus POSTs every 30s with its token + lat/lng
export const runtime = 'nodejs';

// Simple Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { device_token, lat, lng, speed } = body as {
    device_token?: string; lat?: number; lng?: number; speed?: number
  };

  if (!device_token || lat == null || lng == null) {
    return NextResponse.json({ error: 'device_token, lat, lng required' }, { status: 400 });
  }

  // Validate device token
  const { data: device, error: devErr } = await supabaseAdmin
    .from('device_tokens')
    .select('route_id, school_id')
    .eq('token', device_token)
    .maybeSingle();

  if (devErr || !device) {
    return NextResponse.json({ error: 'invalid device token' }, { status: 401 });
  }

  // Stamp last_seen on the device
  await supabaseAdmin.from('device_tokens')
    .update({ last_seen: new Date().toISOString() })
    .eq('token', device_token);

  if (!device.route_id) {
    return NextResponse.json({ received: true, note: 'no route assigned to device' });
  }

  // Geofence: if within 300m of school, set bus_status = 'arriving'
  // School lat/lng from first school matching school_id (MVP approximation)
  const { data: school } = await supabaseAdmin
    .from('schools').select('lat, lng').eq('id', device.school_id).maybeSingle();

  let busStatus = 'en_route';
  if (school?.lat != null && school?.lng != null) {
    const distKm = haversineKm(lat, lng, Number(school.lat), Number(school.lng));
    if (distKm < 0.3) busStatus = 'arriving';
  }

  // Update route location + status
  const { error: updateErr } = await supabaseAdmin
    .from('transport_routes')
    .update({
      current_lat: lat,
      current_lng: lng,
      last_location_at: new Date().toISOString(),
      bus_status: busStatus,
    })
    .eq('id', device.route_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ received: true, bus_status: busStatus, ...(speed != null ? { speed } : {}) });
}
