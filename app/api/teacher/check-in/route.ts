import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireTeacherSession } from '@/lib/teacher-auth';

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const { data, error } = await supabaseAdmin
      .from('teacher_geo_pings')
      .select('id,checked_in_at,lat,lng,note')
      .eq('school_id', session.schoolId)
      .eq('staff_id', session.staffId)
      .order('checked_in_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return NextResponse.json({ checkins: data ?? [] });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const body = await req.json().catch(() => ({})) as { lat?: number; lng?: number; note?: string };
    const { data, error } = await supabaseAdmin
      .from('teacher_geo_pings')
      .insert({
        school_id: session.schoolId, staff_id: session.staffId,
        checked_in_at: new Date().toISOString(),
        lat: body.lat ?? null, lng: body.lng ?? null,
        note: body.note ?? null,
      })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ checkin: data });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
