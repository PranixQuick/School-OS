import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireTeacherSession } from '@/lib/teacher-auth';

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const { data, error } = await supabaseAdmin
      .from('lesson_plans')
      .select('id,class,section,subject,topic,plan_date,duration_mins,objectives,materials,status,created_at')
      .eq('school_id', session.schoolId)
      .eq('staff_id', session.staffId)
      .order('plan_date', { ascending: false })
      .limit(50);
    if (error) throw error;
    const normalised = (data ?? []).map((r: Record<string, unknown>) => ({ ...r, date: r.plan_date }));
    return NextResponse.json({ plans: normalised });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const body = await req.json() as { class: string; section?: string; subject: string; topic: string; date: string; duration_mins?: number; objectives?: string; materials?: string };
    if (!body.class || !body.subject || !body.topic) {
      return NextResponse.json({ error: 'class, subject, topic required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('lesson_plans')
      .insert({
        school_id: session.schoolId, staff_id: session.staffId,
        class: body.class, section: body.section ?? 'A',
        subject: body.subject, topic: body.topic,
        plan_date: body.date || new Date().toISOString().split('T')[0],
        duration_mins: body.duration_mins ?? 45,
        objectives: body.objectives ?? null, materials: body.materials ?? null,
        status: 'planned',
      })
      .select().single();
    if (error) throw error;
    const normalised = { ...data, date: data.plan_date };
    return NextResponse.json({ plan: normalised });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
