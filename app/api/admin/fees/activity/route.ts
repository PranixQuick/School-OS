// app/api/admin/fees/activity/route.ts
// Live "fee activity" feed for staff (owner | principal | admin | admin_staff | accountant).
// Reads the audit_log rows that the fee mutation routes already write (resource='fees'),
// enriched with the student's name, so the principal and owner can see — in near-real-time
// (the UI auto-refreshes) — who created / amended / deleted / settled a fee, the stated
// reason, and the mode of payment.
//
// GET /api/admin/fees/activity?limit=&since=<ISO>
// Auth: requireAdminSession. Institution gate: fee_module_enabled.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const ACTIONS = ['fee.create', 'fee.amend', 'fee.delete', 'fee.mark_paid', 'fee.waive'];

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;
  if (!(await isFeeModuleEnabled(schoolId))) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10) || 30, 100);
  const since = req.nextUrl.searchParams.get('since');

  let q = supabaseAdmin
    .from('audit_log')
    .select('id, action, op, resource_id, old_data, new_data, metadata, created_at')
    .eq('school_id', schoolId)
    .eq('resource', 'fees')
    .in('action', ACTIONS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (since) q = q.gt('created_at', since);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve student name/class for each referenced fee (soft-deleted fees still resolve).
  const feeIds = Array.from(new Set((rows ?? []).map((r) => r.resource_id).filter(Boolean)));
  const studentByFee: Record<string, { name?: string; class?: string; section?: string } | null> = {};
  if (feeIds.length) {
    const { data: fees } = await supabaseAdmin
      .from('fees')
      .select('id, students:student_id ( name, class, section )')
      .in('id', feeIds)
      .eq('school_id', schoolId);
    for (const f of fees ?? []) {
      studentByFee[f.id as string] = (f.students as { name?: string; class?: string; section?: string } | null) ?? null;
    }
  }

  const events = (rows ?? []).map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const nd = (r.new_data ?? {}) as Record<string, unknown>;
    const od = (r.old_data ?? {}) as Record<string, unknown>;
    const stu = studentByFee[r.resource_id as string] ?? null;
    return {
      id: r.id,
      action: r.action as string,
      at: r.created_at as string,
      student: stu ? { name: stu.name ?? null, class: stu.class ?? null, section: stu.section ?? null } : null,
      amount: (nd.amount ?? od.amount ?? null) as number | null,
      fee_type: (nd.fee_type ?? od.fee_type ?? null) as string | null,
      reason: (meta.reason ?? null) as string | null,
      mode: (meta.method ?? nd.payment_method ?? null) as string | null,
      by_role: (meta.by_role ?? null) as string | null,
    };
  });

  return NextResponse.json({ events, server_time: new Date().toISOString() });
}
