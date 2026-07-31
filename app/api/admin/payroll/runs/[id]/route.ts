import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET — single run + payslips
export async function GET(req: NextRequest, { params }: Params) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { id } = await params;

  const [runRes, slipsRes] = await Promise.all([
    supabaseAdmin.from('payroll_runs').select('*').eq('id', id).eq('school_id', ctx.schoolId).single(),
    supabaseAdmin.from('payroll_payslips')
      .select('id, staff_id, gross_salary, total_deductions, net_salary, payment_status, pf_employee, tds, basic_salary, hra, da, staff:staff_id(id, name, designation, department)')
      .eq('run_id', id).eq('school_id', ctx.schoolId),
  ]);

  if (!runRes.data) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  return NextResponse.json({ run: runRes.data, payslips: slipsRes.data ?? [] });
}

// PATCH — payroll run lifecycle.
//
// Approval chain (founder requirement): accountant prepares -> submit_for_review ->
// admin/principal review -> owner approve -> accountant/owner submit_to_bank -> mark_paid.
//
// This is ADDITIVE and non-breaking: the legacy draft -> approve -> mark_paid path
// still works (approve accepts 'draft'), so the current payroll UI keeps functioning
// until the chain buttons ship. Once the UI drives the chain, tighten `approve` to
// accept only 'pending_owner' and restrict it to the owner role.
export async function PATCH(req: NextRequest, { params }: Params) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const ALLOWED = ['owner', 'admin', 'principal', 'accountant'];
  if (!ALLOWED.includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;
  let body: { action?: string; notes?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;

  // from-states -> target state, plus (optional) roles allowed to perform the step.
  const RULES: Record<string, { from: string[]; to: string; roles?: string[] }> = {
    submit_for_review: { from: ['draft'], to: 'pending_review', roles: ['accountant', 'admin', 'owner'] },
    review:            { from: ['pending_review'], to: 'pending_owner', roles: ['admin', 'principal', 'owner'] },
    approve:           { from: ['draft', 'pending_owner'], to: 'approved' },
    submit_to_bank:    { from: ['approved'], to: 'submitted', roles: ['accountant', 'owner'] },
    mark_paid:         { from: ['approved', 'submitted'], to: 'paid' },
    cancel:            { from: ['draft', 'pending_review', 'pending_owner', 'approved'], to: 'cancelled' },
  };

  const rule = action ? RULES[action] : undefined;
  if (!rule) {
    return NextResponse.json({ error: `action must be one of: ${Object.keys(RULES).join(', ')}` }, { status: 400 });
  }
  if (rule.roles && !rule.roles.includes(ctx.userRole)) {
    return NextResponse.json({ error: `Your role (${ctx.userRole}) cannot ${action}. Allowed: ${rule.roles.join(', ')}` }, { status: 403 });
  }

  // Verify run belongs to school and get current status
  const { data: run } = await supabaseAdmin
    .from('payroll_runs').select('id, status').eq('id', id).eq('school_id', ctx.schoolId).single();
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

  if (!rule.from.includes(run.status)) {
    return NextResponse.json({ error: `Cannot ${action} a run in ${run.status} state` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: rule.to };
  if (typeof body.notes === 'string' && body.notes.trim()) patch.notes = body.notes.trim().slice(0, 1000);
  if (action === 'submit_for_review') { patch.submitted_for_review_by = ctx.userId; patch.submitted_for_review_at = now; }
  if (action === 'review')            { patch.reviewed_by = ctx.userId; patch.reviewed_at = now; }
  if (action === 'approve')           { patch.approved_by = ctx.userId; patch.approved_at = now; }
  if (action === 'submit_to_bank')    { patch.submitted_by = ctx.userId; patch.submitted_at = now; }
  if (action === 'mark_paid') {
    // Mark all payslips as paid
    await supabaseAdmin.from('payroll_payslips').update({ payment_status: 'paid', paid_at: now }).eq('run_id', id).eq('school_id', ctx.schoolId);
  }

  const { data, error } = await supabaseAdmin
    .from('payroll_runs').update(patch).eq('id', id).eq('school_id', ctx.schoolId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  void supabaseAdmin.from('payroll_audit_log').insert({
    school_id: ctx.schoolId, run_id: id, action,
    actor_id: ctx.userId, metadata: { new_status: rule.to, notes: body.notes ?? null },
  });

  return NextResponse.json({ run: data });
}
