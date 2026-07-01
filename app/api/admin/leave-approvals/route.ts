// app/api/admin/leave-approvals/route.ts
// Leave approval API — used by principal/HM to review and act on teacher leave requests.
// Institution-aware: works for private (principal role) and govt (principal/HM role).
//
// GET  /api/admin/leave-approvals          → list pending/recent requests for this school
// PATCH /api/admin/leave-approvals         → approve or reject a request
// After approval: if a substitute_assignment row exists for this request, update it too.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/logger';
import { sendWhatsApp, normalisePhone } from '@/lib/whatsapp';

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

  const staffResult = await supabaseAdmin
    .from('staff')
    .select('name')
    .eq('id', existing.staff_id)
    .single();
  const staffName = staffResult.data?.name ?? 'Staff';

  if (body.action === 'approve') {
    await supabaseAdmin
      .from('substitute_assignments')
      .update({ status: 'confirmed' })
      .eq('leave_request_id', body.id)
      .eq('school_id', session.schoolId)
      .eq('status', 'pending')
      .then(null, () => {});

    // Parse date for payroll period
    if (existing.from_date) {
      const fromDate = new Date(existing.from_date);
      const month = fromDate.getMonth() + 1;
      const year = fromDate.getFullYear();
      const days = existing.from_date && existing.to_date
        ? Math.ceil((new Date(existing.to_date).getTime() - new Date(existing.from_date).getTime()) / 86400000) + 1
        : 1;

      // Find any draft payroll run
      const { data: run } = await supabaseAdmin
        .from('payroll_runs')
        .select('id')
        .eq('school_id', session.schoolId)
        .eq('pay_period_month', month)
        .eq('pay_period_year', year)
        .eq('status', 'draft')
        .maybeSingle();

      if (run) {
        const { data: payslip } = await supabaseAdmin
          .from('payroll_payslips')
          .select('id, basic_salary, gross_salary, working_days, days_present, days_absent, leave_days_paid, total_deductions')
          .eq('run_id', run.id)
          .eq('staff_id', existing.staff_id)
          .maybeSingle();

        if (payslip) {
          if (existing.leave_type === 'unpaid') {
            const newAbsent = Number(payslip.days_absent || 0) + days;
            const newPresent = Math.max(0, Number(payslip.days_present || 26) - days);
            const gross = Number(payslip.gross_salary || 0);
            const working = Number(payslip.working_days || 26);
            const dailyRate = working > 0 ? gross / working : 0;
            const adjustedGross = Math.max(0, gross - (dailyRate * newAbsent));
            const net = Math.max(0, adjustedGross - Number(payslip.total_deductions || 0));

            await supabaseAdmin
              .from('payroll_payslips')
              .update({
                days_absent: newAbsent,
                days_present: newPresent,
                adjusted_gross: adjustedGross,
                net_salary: net,
              })
              .eq('id', payslip.id);
          } else {
            const newPaidLeave = Number(payslip.leave_days_paid || 0) + days;
            await supabaseAdmin
              .from('payroll_payslips')
              .update({
                leave_days_paid: newPaidLeave,
              })
              .eq('id', payslip.id);
          }

          // Re-sum payroll run totals
          const { data: allPayslips } = await supabaseAdmin
            .from('payroll_payslips')
            .select('adjusted_gross, total_deductions, net_salary')
            .eq('run_id', run.id);

          if (allPayslips) {
            const runGross = allPayslips.reduce((sum, p) => sum + Number(p.adjusted_gross || 0), 0);
            const runNet = allPayslips.reduce((sum, p) => sum + Number(p.net_salary || 0), 0);
            await supabaseAdmin
              .from('payroll_runs')
              .update({ total_gross: runGross, total_net: runNet })
              .eq('id', run.id);
          }
        }
      }
    }

    // Parent notification & real-time broadcasts
    const { data: assignments } = await supabaseAdmin
      .from('staff_class_assignments')
      .select('class, section')
      .eq('staff_id', existing.staff_id)
      .eq('school_id', session.schoolId);

    const classes = assignments ?? [];
    for (const cls of classes) {
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('id, name, parent_name, phone_parent')
        .eq('class', cls.class)
        .eq('section', cls.section)
        .eq('school_id', session.schoolId)
        .eq('is_active', true);

      if (students && students.length > 0) {
        const msgBody = `Please note that teacher ${staffName} has been approved for leave from ${existing.from_date} to ${existing.to_date}. Substitute arrangements are in place.`;
        await supabaseAdmin
          .from('broadcasts')
          .insert({
            school_id: session.schoolId,
            title: `Teacher Leave Notice: ${staffName}`,
            message: msgBody,
            created_at: new Date().toISOString(),
          });

        for (const s of students) {
          if (s.phone_parent) {
            const normalised = normalisePhone(s.phone_parent);
            if (normalised) {
              await sendWhatsApp({
                to: normalised,
                body: `Dear Parent, please be informed that teacher ${staffName} will be on leave from ${existing.from_date} to ${existing.to_date}. Substitute arrangements are in place.`,
              });
            }
          }
        }
      }
    }
  }

  await logActivity({
    schoolId: session.schoolId,
    action:   `Leave ${newStatus}: ${staffName} — ${existing.leave_type} (${existing.from_date} to ${existing.to_date})`,
    module:   'import',  // 'import' is the allowed catch-all module in logActivity union type
    details:  { request_id: body.id, action: body.action, rejection_reason: body.rejection_reason, type: 'leave_approval' },
  });

  return NextResponse.json({ success: true, status: newStatus, request_id: body.id });
}
