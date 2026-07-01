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

// PATCH — approve or mark paid
export async function PATCH(req: NextRequest, { params }: Params) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  if (!['owner','admin','accountant'].includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id } = await params;
  let body: { action?: string; notes?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;
  if (!['approve', 'mark_paid', 'cancel'].includes(action ?? '')) {
    return NextResponse.json({ error: 'action must be approve, mark_paid, or cancel' }, { status: 400 });
  }

  // Verify run belongs to school and get current status
  const { data: run } = await supabaseAdmin
    .from('payroll_runs').select('id, status').eq('id', id).eq('school_id', ctx.schoolId).single();
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

  const transitions: Record<string, { from: string[]; to: string }> = {
    approve:   { from: ['draft'], to: 'approved' },
    mark_paid: { from: ['approved'], to: 'paid' },
    cancel:    { from: ['draft', 'approved'], to: 'cancelled' },
  };

  const t = transitions[action!];
  if (!t.from.includes(run.status)) {
    return NextResponse.json({ error: `Cannot ${action} a run in ${run.status} state` }, { status: 409 });
  }

  const patch: Record<string, unknown> = { status: t.to };
  if (action === 'approve') { patch.approved_by = ctx.userId; patch.approved_at = new Date().toISOString(); }
  if (action === 'mark_paid') {
    // Mark all payslips as paid
    await supabaseAdmin.from('payroll_payslips').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('run_id', id).eq('school_id', ctx.schoolId);
  }

  const { data, error } = await supabaseAdmin
    .from('payroll_runs').update(patch).eq('id', id).eq('school_id', ctx.schoolId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log
  void supabaseAdmin.from('payroll_audit_log').insert({
    school_id: ctx.schoolId, run_id: id, action: action,
    actor_id: ctx.userId, metadata: { new_status: t.to },
  });

  return NextResponse.json({ run: data });
}
