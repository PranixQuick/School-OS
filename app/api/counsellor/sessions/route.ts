// app/api/counsellor/sessions/route.ts
// Counsellor: create a session note (POST) and mark a follow-up done (PATCH).
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
const ALLOWED = ['counsellor', 'admin', 'owner', 'principal'];

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED.includes(session.userRole)) return NextResponse.json({ error: 'Counsellor role required' }, { status: 403 });
  const schoolId = session.schoolId;

  let body: { student_id?: string; concern?: string; action_taken?: string; follow_up_date?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { student_id, concern, action_taken, follow_up_date } = body;
  if (!student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });
  if (!concern?.trim() && !action_taken?.trim()) return NextResponse.json({ error: 'Enter a concern or action' }, { status: 400 });

  const { data: stu } = await supabaseAdmin.from('students').select('id, school_id').eq('id', student_id).maybeSingle();
  if (!stu || stu.school_id !== schoolId) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin.from('counselling_sessions').insert({
    school_id: schoolId,
    student_id,
    counsellor_id: session.userId,
    concern: concern?.trim() || null,
    action_taken: action_taken?.trim() || null,
    follow_up_date: follow_up_date || null,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED.includes(session.userRole)) return NextResponse.json({ error: 'Counsellor role required' }, { status: 403 });
  const schoolId = session.schoolId;

  let body: { id?: string; follow_up_done?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, follow_up_done } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('counselling_sessions')
    .update({ follow_up_done: follow_up_done ?? true })
    .eq('id', id)
    .eq('school_id', schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
