import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

// K6: Parent portal transport API — returns bus location + status for student's route
// Auth: session cookie
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const { parentId, schoolId } = session;


  // Find student's transport route via transport_assignments or route_stops
  // MVP: find any active route for this school that has a recent location
  const { data: routes } = await supabaseAdmin
    .from('transport_routes')
    .select('id, name, current_lat, current_lng, last_location_at, bus_status')
    .eq('school_id', schoolId)
    .not('current_lat', 'is', null)
    .order('last_location_at', { ascending: false })
    .limit(1);

  if (!routes?.length) {
    return NextResponse.json({ transport: null, message: 'No active bus location available' });
  }

  const route = routes[0];
  return NextResponse.json({
    transport: {
      route_id: route.id,
      route_name: route.name ?? 'School Bus',
      current_lat: route.current_lat,
      current_lng: route.current_lng,
      last_location_at: route.last_location_at,
      bus_status: route.bus_status ?? 'unknown',
    },
  });
}
