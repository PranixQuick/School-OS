import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
  const schoolId = session.schoolId;
  try {
    const [sessionsRes, slotsRes] = await Promise.all([
      supabaseAdmin.from('ptm_sessions').select('*').eq('school_id', schoolId).order('date', { ascending: true }),
      supabaseAdmin.from('ptm_slots').select('id, session_id, staff_id, student_id, slot_time, status, parent_confirmed, staff(name), students(name, parent_name)').eq('school_id', schoolId).order('slot_time', { ascending: true }),
    ]);
    return NextResponse.json({ sessions: sessionsRes.data ?? [], slots: slotsRes.data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
  const schoolId = session.schoolId;
  try {
    const body = await req.json() as { title: string; date: string; start_time: string; end_time: string; target_classes: string[]; slot_duration_minutes: number; };
    const { data: created, error } = await supabaseAdmin.from('ptm_sessions').insert({ school_id: schoolId, ...body, status: 'scheduled' }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, session: created });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
  const schoolId = session.schoolId;
  try {
    const { slotId, status } = await req.json() as { slotId: string; status: string };
    if (!slotId || !status) return NextResponse.json({ error: 'slotId and status required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('ptm_slots').update({ status }).eq('id', slotId).eq('school_id', schoolId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
