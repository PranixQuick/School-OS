// app/api/principal/leave-approvals/route.ts
// Item #6 Principal Dashboard — Loop 3: teacher leave approvals.
//
// GET  /api/principal/leave-approvals — pending teacher_leave_requests + recently
//                                         decided (last 14 days)
// POST /api/principal/leave-approvals — approve or reject. Body:
//   { id: uuid, decision: 'approved' | 'rejected' }
//
// OPTION_B compliance:
//   - Every query .eq('school_id', ctx.schoolId)
//   - approved_by sourced from principal's staff_id (session) — never request body
//   - // TODO(item-15): migrate to supabaseForUser when service-role audit lands

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { writeNotification } from '@/lib/notifications'; // Item #14 PR #2
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

interface DecideBody {
  id: string;
  decision: 'approved' | 'rejected';
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidDecideBody(b: unknown): b is DecideBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return isUuid(o.id) && (o.decision === 'approved' || o.decision === 'rejected');
}

async function resolveCtx(req: NextRequest) {
  try { return { ctx: await requirePrincipalSession(req), errResp: null as null }; }
  catch (e) {
    if (e instanceof PrincipalAuthError) return { ctx: null, errResp: NextResponse.json({ error: e.message }, { status: e.status }) };
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { schoolId } = ctx!;

  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();

  // Pending — no time window
  const pendingRes = await supabaseAdmin
    .from('teacher_leave_requests')
    .select('id, staff_id, leave_type, from_date, to_date, reason, status, created_at')
    .eq('school_id', schoolId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (pendingRes.error) {
    return NextResponse.json({ error: pendingRes.error.message }, { status: 500 });
  }

  // Recently decided — last 14 days
  const recentRes = await supabaseAdmin
    .from('teacher_leave_requests')
    .select('id, staff_id, leave_type, from_date, to_date, status, approved_by, approved_at')
    .eq('school_id', schoolId)
    .in('status', ['approved', 'rejected'])
    .gte('approved_at', fourteenDaysAgo)
    .order('approved_at', { ascending: false })
    .limit(50);

  if (recentRes.error) {
    return NextResponse.json({ error: recentRes.error.message }, { status: 500 });
  }

  // Hydrate staff names in a single query
  const allStaffIds = new Set<string>();
  for (const r of pendingRes.data ?? []) allStaffIds.add(r.staff_id);
  for (const r of recentRes.data ?? []) allStaffIds.add(r.staff_id);

  let staffMap: Record<string, { name: string; subject: string | null }> = {};
  if (allStaffIds.size > 0) {
    const staffRes = await supabaseAdmin
      .from('staff')
      .select('id, name, subject')
      .in('id', Array.from(allStaffIds))
      .eq('school_id', schoolId);
    if (staffRes.error) {
      return NextResponse.json({ error: staffRes.error.message }, { status: 500 });
    }
    staffMap = Object.fromEntries(
      (staffRes.data ?? []).map((s) => [s.id, { name: s.name, subject: s.subject }])
    );
  }

  const hydrate = <T extends { staff_id: string }>(rows: T[] | null) =>
    (rows ?? []).map((r) => ({
      ...r,
      staff_name: staffMap[r.staff_id]?.name ?? 'Unknown',
      staff_subject: staffMap[r.staff_id]?.subject ?? null,
    }));

  return NextResponse.json({
    pending: hydrate(pendingRes.data),
    recent_decisions: hydrate(recentRes.data),
    pending_count: (pendingRes.data ?? []).length,
  });
}

export async function POST(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId: principalStaffId, schoolId } = ctx!;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidDecideBody(body)) {
    return NextResponse.json(
      { error: 'Body must include id (uuid) and decision ("approved" or "rejected")' },
      { status: 400 }
    );
  }

  // Verify the leave request exists and is still pending (defense against double-decision)
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from('teacher_leave_requests')
    .select('id, status, staff_id, from_date, to_date')
    .eq('id', body.id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: 'Leave request is already ' + existing.status },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('teacher_leave_requests')
    .update({
      status: body.decision,
      approved_by: principalStaffId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .eq('school_id', schoolId)
    .select('id, status, approved_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Item #14 PR #2: best-effort notification on leave approved/rejected
  try {
    // Quick staff name lookup for notification message
    const { data: staffRow } = await supabaseAdmin.from('staff').select('name').eq('id', existing.staff_id).eq('school_id', schoolId).maybeSingle();
    const staffName = staffRow?.name ?? 'staff';
    await writeNotification(supabaseAdmin, {
      school_id: schoolId,
      type: 'leave_status',
      title: `Leave request ${body.decision}`,
      message: `Leave request for ${staffName} from ${existing.from_date} to ${existing.to_date} has been ${body.decision}.`,
      module: 'leave',
      reference_id: body.id,
    });
  } catch (notifErr) { console.error('[leave-approvals] notification hook failed (non-fatal):', notifErr); }

  return NextResponse.json({ leave_request: data });
}
