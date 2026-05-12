// app/api/teacher/homework/route.ts
// Item #1 Track C Phase 3 PR #2b — Teacher homework workflows.
//
// GET  /api/teacher/homework — list homework assigned by this teacher (last 60 days)
// POST /api/teacher/homework — create a new homework assignment
//
// Defense-in-depth per OPTION_B_SUPABASE_ADMIN_WITH_EXPLICIT_SCOPING:
//   Every query .eq('assigned_by', ctx.staffId).eq('school_id', ctx.schoolId)
//   RLS additive policies auth_read_teacher_homework / auth_write_teacher_homework
//
// TODO(item-15): migrate to supabaseForUser(accessToken) when service-role audit lands.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

interface CreateBody {
  class_id: string;
  subject_id: string;
  title: string;
  description?: string;
  due_date: string; // YYYY-MM-DD
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

function isValidBody(b: unknown): b is CreateBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    isUuid(o.class_id) &&
    isUuid(o.subject_id) &&
    typeof o.title === 'string' && o.title.length >= 3 && o.title.length <= 200 &&
    (o.description === undefined || (typeof o.description === 'string' && o.description.length <= 2000)) &&
    isValidDate(o.due_date)
  );
}

async function resolveCtx(req: NextRequest) {
  try {
    return { ctx: await requireTeacherSession(req), errResp: null as null };
  } catch (e) {
    if (e instanceof TeacherAuthError) {
      return { ctx: null, errResp: NextResponse.json({ error: e.message }, { status: e.status }) };
    }
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId } = ctx!;

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('homework')
    .select('id, class_id, subject_id, title, description, due_date, created_at')
    .eq('assigned_by', staffId)
    .eq('school_id', schoolId)
    .gte('due_date', sixtyDaysAgo)
    .order('due_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ homework: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId } = ctx!;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Body must include class_id (uuid), subject_id (uuid), title (3-200 chars), optional description (<=2000 chars), and due_date (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // Verify the teacher actually teaches this class (defense against IDOR via class_id)
  const { data: ttRow } = await supabaseAdmin
    .from('timetable')
    .select('id')
    .eq('staff_id', staffId)
    .eq('school_id', schoolId)
    .eq('class_id', body.class_id)
    .eq('subject_id', body.subject_id)
    .limit(1)
    .maybeSingle();
  if (!ttRow) {
    return NextResponse.json(
      { error: 'You are not scheduled to teach this class/subject combination' },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('homework')
    .insert({
      school_id: schoolId,
      class_id: body.class_id,
      subject_id: body.subject_id,
      assigned_by: staffId,
      title: body.title.trim(),
      description: body.description?.trim() ?? null,
      due_date: body.due_date,
    })
    .select('id, class_id, subject_id, title, due_date, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ homework: data }, { status: 201 });
}
