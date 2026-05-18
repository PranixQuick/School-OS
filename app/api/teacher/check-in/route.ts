import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireTeacherSession } from '@/lib/teacher-auth';

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const { data, error } = await supabaseAdmin
      .from('teacher_geo_pings')
      .select('id,ping_at,lat,lng')
      .eq('school_id', session.schoolId)
      .eq('staff_id', session.staffId)
      .order('ping_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    // Normalise ping_at → checked_in_at for the UI
    const normalised = (data ?? []).map((r: Record<string, unknown>) => ({ ...r, checked_in_at: r.ping_at, note: null }));
    return NextResponse.json({ checkins: normalised });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const body = await req.json().catch(() => ({})) as { lat?: number; lng?: number };
    const { data, error } = await supabaseAdmin
      .from('teacher_geo_pings')
      .insert({
        school_id: session.schoolId, staff_id: session.staffId,
        ping_at: new Date().toISOString(),
        lat: body.lat ?? null, lng: body.lng ?? null,
        inside_polygon: false,
      })
      .select().single();
    if (error) throw error;
    const normalised = { ...data, checked_in_at: data.ping_at, note: null };
    return NextResponse.json({ checkin: normalised });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
