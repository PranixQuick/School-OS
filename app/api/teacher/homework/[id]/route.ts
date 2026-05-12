// app/api/teacher/homework/[id]/route.ts
// Item #1 Track C Phase 3 PR #2b — homework detail + submission grading.
//
// GET   /api/teacher/homework/[id] — homework details + submissions list
// PATCH /api/teacher/homework/[id] — grade a submission (sets status='graded')
//
// PATCH body: { submission_id: uuid, marks_obtained: number, teacher_remarks?: string }
//
// Defense-in-depth: every read/write gated on assigned_by = ctx.staffId. RLS
// auth_read_teacher_hw_subs / auth_update_teacher_hw_subs join through homework
// table to verify ownership.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface GradeBody {
  submission_id: string;
  marks_obtained: number;
  teacher_remarks?: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidGradeBody(b: unknown): b is GradeBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    isUuid(o.submission_id) &&
    typeof o.marks_obtained === 'number' && o.marks_obtained >= 0 && o.marks_obtained <= 1000 &&
    (o.teacher_remarks === undefined || (typeof o.teacher_remarks === 'string' && o.teacher_remarks.length <= 1000))
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

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId } = ctx!;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid homework id' }, { status: 400 });

  // Verify ownership before reading submissions
  const { data: hw, error: hwErr } = await supabaseAdmin
    .from('homework')
    .select('id, class_id, subject_id, title, description, due_date, attachments, created_at')
    .eq('id', id)
    .eq('assigned_by', staffId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (hwErr) return NextResponse.json({ error: hwErr.message }, { status: 500 });
  if (!hw) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: subs, error: subErr } = await supabaseAdmin
    .from('homework_submissions')
    .select('id, student_id, submitted_at, status, marks_obtained, teacher_remarks')
    .eq('homework_id', id)
    .order('submitted_at', { ascending: true, nullsFirst: false });

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  return NextResponse.json({ homework: hw, submissions: subs ?? [] });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId } = ctx!;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid homework id' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isValidGradeBody(body)) {
    return NextResponse.json(
      { error: 'Body must include submission_id (uuid), marks_obtained (0-1000), optional teacher_remarks (<=1000 chars)' },
      { status: 400 }
    );
  }

  // Verify the homework belongs to this teacher
  const { data: hw } = await supabaseAdmin
    .from('homework')
    .select('id')
    .eq('id', id)
    .eq('assigned_by', staffId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!hw) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify the submission belongs to this homework
  const { data: sub } = await supabaseAdmin
    .from('homework_submissions')
    .select('id')
    .eq('id', body.submission_id)
    .eq('homework_id', id)
    .maybeSingle();
  if (!sub) return NextResponse.json({ error: 'Submission not found for this homework' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('homework_submissions')
    .update({
      status: 'graded',
      marks_obtained: body.marks_obtained,
      teacher_remarks: body.teacher_remarks?.trim() ?? null,
    })
    .eq('id', body.submission_id)
    .eq('homework_id', id)
    .select('id, status, marks_obtained, teacher_remarks')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submission: data });
}
