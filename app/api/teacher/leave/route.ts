// app/api/teacher/leave/route.ts
// Item #1 Track C Phase 3 — Teacher leave requests.
//
// GET  /api/teacher/leave — list this teacher's leave requests (last 90 days)
// POST /api/teacher/leave — submit a new leave request
//
// Defense-in-depth per OPTION_B_SUPABASE_ADMIN_WITH_EXPLICIT_SCOPING:
//   Every query .eq('staff_id', ctx.staffId).eq('school_id', ctx.schoolId)
//   RLS additive policies auth_read_teacher_leave / auth_write_teacher_leave back this up
//
// TODO(item-15): migrate to supabaseForUser(accessToken) when service-role audit lands.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const VALID_LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid', 'other'] as const;
type LeaveType = (typeof VALID_LEAVE_TYPES)[number];

interface SubmitBody {
  leave_type: LeaveType;
  from_date: string; // YYYY-MM-DD
  to_date: string;
  reason: string;
}

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

function isValidBody(b: unknown): b is SubmitBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.leave_type === 'string' &&
    (VALID_LEAVE_TYPES as readonly string[]).includes(o.leave_type) &&
    isValidDate(o.from_date) &&
    isValidDate(o.to_date) &&
    typeof o.reason === 'string' &&
    o.reason.length >= 3 &&
    o.reason.length <= 500
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

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('teacher_leave_requests')
    .select('id, leave_type, from_date, to_date, reason, status, approved_at, created_at')
    .eq('staff_id', staffId)
    .eq('school_id', schoolId)
    .gte('from_date', ninetyDaysAgo)
    .order('from_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
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
      { error: `Body must include leave_type (${VALID_LEAVE_TYPES.join('|')}), from_date and to_date (YYYY-MM-DD), and reason (3-500 chars)` },
      { status: 400 }
    );
  }

  // Validate date order
  if (new Date(body.from_date) > new Date(body.to_date)) {
    return NextResponse.json({ error: 'from_date must be on or before to_date' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_leave_requests')
    .insert({
      school_id: schoolId,
      staff_id: staffId,
      leave_type: body.leave_type,
      from_date: body.from_date,
      to_date: body.to_date,
      reason: body.reason.trim(),
      status: 'pending',
    })
    .select('id, leave_type, from_date, to_date, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}
