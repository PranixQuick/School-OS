import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';

// Principal fetches the currently active geofence for their school.
// Auth: session cookie (principal role).
// Returns the most recent geofence with active_to IS NULL AND active_from <= NOW().

export async function GET(req: NextRequest) {
  try {
    let principalCtx;
    try {
      principalCtx = await requirePrincipalSession(req);
    } catch (e) {
      if (e instanceof PrincipalAuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
    const { schoolId } = principalCtx;


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
