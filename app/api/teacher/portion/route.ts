import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

const ALLOWED_STATUS = new Set(['planned', 'in_progress', 'completed']);

// Resolve the teacher's staff_id from their school_users row.
async function teacherStaffId(session: { userId: string; schoolId: string }): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('school_users')
    .select('staff_id')
    .eq('id', session.userId)
    .eq('school_id', session.schoolId)
    .maybeSingle();
  return (data?.staff_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
  if (session.userRole !== 'teacher') return NextResponse.json({ error: 'Not a teacher' }, { status: 403 });

  const staffId = await teacherStaffId(session);
  if (!staffId) return NextResponse.json({ portion: [] });

  const { data, error } = await supabaseAdmin
    .from('yearly_syllabus_plan')
    .select(`
      id, week_number, topic_name, chapter_ref, status,
      classes:class_id ( grade_level, section ),
      subjects:subject_id ( name )
    `)
    .eq('staff_id', staffId)
    .eq('school_id', session.schoolId)
    .order('week_number', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ portion: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
  if (session.userRole !== 'teacher') return NextResponse.json({ error: 'Not a teacher' }, { status: 403 });

  const staffId = await teacherStaffId(session);
  if (!staffId) return NextResponse.json({ error: 'No staff profile' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id, status } = body as Record<string, any>;
  if (!id || !status || !ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: 'id and a valid status (planned | in_progress | completed) are required.' }, { status: 400 });
  }

  // Only the assigned teacher may update their own topic.
  const { data: row } = await supabaseAdmin
    .from('yearly_syllabus_plan')
    .select('id, staff_id')
    .eq('id', id)
    .maybeSingle();
  if (!row || (row as any).staff_id !== staffId) {
    return NextResponse.json({ error: 'That topic is not assigned to you.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('yearly_syllabus_plan')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
