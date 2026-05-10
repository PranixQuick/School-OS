import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Principal fetches the currently active geofence for their school.
// Auth: session cookie (middleware sets x-school-id header).
// Returns the most recent geofence with active_to IS NULL AND active_from <= NOW().

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    const { data: geofence, error: gErr } = await supabaseAdmin
      .from('school_geofences')
      .select('id, polygon_geojson, radius_meters_fallback, active_from, active_to, created_at')
      .eq('school_id', schoolId)
      .is('active_to', null)
      .lte('active_from', new Date().toISOString())
      .order('active_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (gErr) {
      console.error('Geofence fetch error:', gErr);
      return NextResponse.json({ error: 'Failed to fetch geofence' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      geofence: geofence ?? null,
    });

  } catch (err) {
    console.error('Geofence get error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
