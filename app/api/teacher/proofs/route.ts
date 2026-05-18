import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireTeacherSession } from '@/lib/teacher-auth';

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const { data, error } = await supabaseAdmin
      .from('teacher_proofs')
      .select('id,title,class,section,subject,proof_type,note,image_url,created_at')
      .eq('school_id', session.schoolId)
      .eq('staff_id', session.staffId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ proofs: data ?? [] });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const body = await req.json() as { title: string; class: string; section?: string; subject: string; proof_type?: string; note?: string };
    if (!body.title || !body.class || !body.subject) {
      return NextResponse.json({ error: 'title, class, subject required' }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from('teacher_proofs')
      .insert({
        school_id: session.schoolId, staff_id: session.staffId,
        title: body.title, class: body.class, section: body.section ?? 'A',
        subject: body.subject, proof_type: body.proof_type ?? 'classroom_activity',
        note: body.note ?? null, image_url: null,
      })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ proof: data });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
