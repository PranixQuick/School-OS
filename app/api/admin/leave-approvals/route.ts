// app/api/admin/leave-approvals/route.ts
// Leave approval API — used by principal/HM to review and act on teacher leave requests.
// Institution-aware: works for private (principal role) and govt (principal/HM role).
//
// GET  /api/admin/leave-approvals          → list pending/recent requests for this school
// PATCH /api/admin/leave-approvals         → approve or reject a request
// After approval: if a substitute_assignment row exists for this request, update it too.
// After rejection: add a payroll note (future: deduct LOP).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['principal', 'admin', 'owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Principal or admin role required' }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'pending';

  const { data: requests, error } = await supabaseAdmin
    .from('teacher_leave_requests')
    .select(`
      id, leave_type, from_date, to_date, reason, status,
      approved_by, approved_at, created_at,
      staff:staff_id ( id, name, role, designation, subject, email )
    `)
    .eq('school_id', session.schoolId)
    .in('status', status === 'all' ? ['pending','approved','rejected'] : [status])
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calculate leave days for each request
  const enriched = (requests ?? []).map(r => ({
    ...r,
    days: r.from_date && r.to_date
      ? Math.ceil((new Date(r.to_date).getTime() - new Date(r.from_date).getTime()) / 86400000) + 1
      : null,
  }));

  return NextResponse.json({ requests: enriched, total: enriched.length });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['principal', 'admin', 'owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Principal or admin role required' }, { status: 403 });
  }

  let body: { id?: string; action?: 'approve' | 'reject'; rejection_reason?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (!body?.action || !['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  const newStatus = body.action === 'approve' ? 'approved' : 'rejected';

  // Verify the request belongs to this school and is still pending
  const { data: existing } = await supabaseAdmin
    .from('teacher_leave_requests')
    .select('id, status, staff_id, from_date, to_date, leave_type')
    .eq('id', body.id)
    .eq('school_id', session.schoolId)
    .single();

  if (!existing) return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: `Cannot ${body.action} — request is already ${existing.status}` }, { status: 409 });
  }

  // Update the leave request
  const { error: updateErr } = await supabaseAdmin
    .from('teacher_leave_requests')
    .update({
      status:      newStatus,
      approved_by: session.userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .eq('school_id', session.schoolId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // If approved, look for existing substitute assignments to update
  if (body.action === 'approve') {
    await supabaseAdmin
      .from('substitute_assignments')
      .update({ status: 'confirmed' })
      .eq('leave_request_id', body.id)
      .eq('school_id', session.schoolId)
      .eq('status', 'pending')
      .then(null, () => {}); // non-blocking
  }

  const staffResult = await supabaseAdmin
    .from('staff')
    .select('name')
    .eq('id', existing.staff_id)
    .single();
  const staffName = staffResult.data?.name ?? 'Staff';

  await logActivity({
    schoolId: session.schoolId,
    action:   `Leave ${newStatus}: ${staffName} — ${existing.leave_type} (${existing.from_date} to ${existing.to_date})`,
    module:   'leave_management',
    details:  { request_id: body.id, action: body.action, rejection_reason: body.rejection_reason },
  });

  return NextResponse.json({ success: true, status: newStatus, request_id: body.id });
}
