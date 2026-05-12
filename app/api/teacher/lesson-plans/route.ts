// app/api/teacher/lesson-plans/route.ts
// Item #1 Track C Phase 3 PR #2b — Teacher lesson plans.
//
// GET   /api/teacher/lesson-plans?from=YYYY-MM-DD&to=YYYY-MM-DD — list (default last 30d)
// POST  /api/teacher/lesson-plans — create a new lesson plan
// PATCH /api/teacher/lesson-plans — mark lesson plan completion_status
//
// PATCH body: { id: uuid, completion_status: 'planned'|'in_progress'|'completed'|'skipped', notes?: string }
//
// Defense-in-depth: every query .eq('staff_id', staffId).eq('school_id', schoolId).
// RLS additive auth_read_teacher_lp / auth_write_teacher_lp / auth_update_teacher_lp.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const VALID_STATUSES = ['planned', 'in_progress', 'completed', 'skipped'] as const;
type Status = (typeof VALID_STATUSES)[number];

interface CreateBody {
  class_id: string;
  subject_id: string;
  planned_date: string;
  notes?: string;
}

interface UpdateBody {
  id: string;
  completion_status: Status;
  notes?: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}
function isCreateBody(b: unknown): b is CreateBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return isUuid(o.class_id) && isUuid(o.subject_id) && isValidDate(o.planned_date) &&
    (o.notes === undefined || (typeof o.notes === 'string' && o.notes.length <= 2000));
}
function isUpdateBody(b: unknown): b is UpdateBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return isUuid(o.id) &&
    typeof o.completion_status === 'string' &&
    (VALID_STATUSES as readonly string[]).includes(o.completion_status) &&
    (o.notes === undefined || (typeof o.notes === 'string' && o.notes.length <= 2000));
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

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const fromDate = isValidDate(from) ? from : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = isValidDate(to) ? to : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, class_id, subject_id, planned_date, completion_status, completed_at, notes, created_at')
    .eq('staff_id', staffId)
    .eq('school_id', schoolId)
    .gte('planned_date', fromDate)
    .lte('planned_date', toDate)
    .order('planned_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lesson_plans: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId } = ctx!;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!isCreateBody(body)) {
    return NextResponse.json({ error: 'Body must include class_id, subject_id (uuids), planned_date (YYYY-MM-DD), optional notes' }, { status: 400 });
  }

  // Verify the teacher teaches this class/subject
  const { data: ttRow } = await supabaseAdmin
    .from('timetable')
    .select('id')
    .eq('staff_id', staffId).eq('school_id', schoolId)
    .eq('class_id', body.class_id).eq('subject_id', body.subject_id)
    .limit(1).maybeSingle();
  if (!ttRow) return NextResponse.json({ error: 'You are not scheduled to teach this class/subject' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('lesson_plans')
    .insert({
      school_id: schoolId, staff_id: staffId,
      class_id: body.class_id, subject_id: body.subject_id,
      planned_date: body.planned_date,
      completion_status: 'planned',
      notes: body.notes?.trim() ?? null,
    })
    .select('id, class_id, subject_id, planned_date, completion_status, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lesson_plan: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId } = ctx!;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!isUpdateBody(body)) {
    return NextResponse.json({ error: 'Body must include id (uuid), completion_status (planned|in_progress|completed|skipped), optional notes' }, { status: 400 });
  }

  const completedAt = body.completion_status === 'completed' ? new Date().toISOString() : null;

  const { data, error } = await supabaseAdmin
    .from('lesson_plans')
    .update({
      completion_status: body.completion_status,
      completed_at: completedAt,
      ...(body.notes !== undefined ? { notes: body.notes?.trim() } : {}),
    })
    .eq('id', body.id)
    .eq('staff_id', staffId)
    .eq('school_id', schoolId)
    .select('id, completion_status, completed_at, notes')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ lesson_plan: data });
}
