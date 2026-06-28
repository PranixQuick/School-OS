// app/api/admin/fees/[id]/route.ts
// Amend + delete a single fee, with a MANDATORY reason and a full audit trail.
//
// PATCH  /api/admin/fees/:id   — amend amount / due date / fee type / description
//                                (owner-only: discount_amount + discount_reason)
// DELETE /api/admin/fees/:id   — soft-cancel a fee (kept for audit, hidden from views)
//
// Auth: requireAdminSession. Write roles: owner | principal | admin | admin_staff | accountant.
//       Discounts may ONLY be applied by the owner (sole right to discount).
// Every mutation writes a row to audit_log (old_data, new_data, reason) so the change is
// traceable to a staff member and a stated purpose.
//
// Institution gate: fee_module_enabled.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const WRITE_ROLES = ['owner', 'principal', 'admin', 'admin_staff', 'accountant'] as const;
const FEE_TYPES = ['tuition', 'transport', 'activity', 'exam', 'other'] as const;
// A settled fee can't be amended or deleted in place — it must be refunded/reversed.
const SETTLED = ['paid', 'waived'] as const;

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function cleanReason(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 3 && t.length <= 500 ? t : null;
}

interface AuditInput {
  schoolId: string; userId: string | null; action: string; op: string;
  resourceId: string; oldData: unknown; newData: unknown; metadata: Record<string, unknown>;
  req: NextRequest;
}
async function writeAudit(a: AuditInput) {
  try {
    await supabaseAdmin.from('audit_log').insert({
      school_id: a.schoolId,
      user_id: a.userId,
      action: a.action,
      op: a.op,
      resource: 'fees',
      resource_id: a.resourceId,
      old_data: a.oldData ?? null,
      new_data: a.newData ?? null,
      metadata: a.metadata,
      ip: (a.req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
      user_agent: a.req.headers.get('user-agent') ?? null,
    });
  } catch (e) {
    // Audit must never silently swallow a mutation, but it also must not break the user action.
    console.error('[fees/:id] audit_log write failed (non-fatal):', e);
  }
}

// ─── PATCH (amend) ────────────────────────────────────────────────────────────
interface AmendBody {
  reason: string;
  amount?: number;
  due_date?: string;
  fee_type?: string;
  description?: string | null;
  discount_amount?: number;   // owner only
  discount_reason?: string;   // owner only
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, staffId, userId, userRole } = ctx;
  if (!(WRITE_ROLES as readonly string[]).includes(userRole)) {
    return NextResponse.json({ error: 'Your role cannot amend fees' }, { status: 403 });
  }

  const { id: feeId } = await params;
  if (!isUuid(feeId)) return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });

  if (!(await isFeeModuleEnabled(schoolId))) {
    return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });
  }

  let body: AmendBody;
  try { body = (await req.json()) as AmendBody; }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const reason = cleanReason(body.reason);
  if (!reason) return NextResponse.json({ error: 'A reason (3–500 chars) is required for this change' }, { status: 400 });

  const wantsDiscount = body.discount_amount !== undefined;
  if (wantsDiscount && userRole !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can apply or change a discount' }, { status: 403 });
  }

  // Load current fee (this school only).
  const { data: fee, error: lookupErr } = await supabaseAdmin
    .from('fees')
    .select('id, status, amount, original_amount, due_date, fee_type, description, discount_amount, discount_reason, is_deleted')
    .eq('id', feeId).eq('school_id', schoolId).maybeSingle();
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!fee || fee.is_deleted) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  if ((SETTLED as readonly string[]).includes(fee.status)) {
    return NextResponse.json({ error: `Fee is ${fee.status} and cannot be amended. Issue a refund/reversal instead.` }, { status: 409 });
  }

  // Build the update from provided fields only.
  const updates: Record<string, unknown> = {};
  if (body.amount !== undefined) {
    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    updates.amount = body.amount;
    updates.original_amount = fee.original_amount ?? body.amount;
  }
  if (body.due_date !== undefined) {
    if (typeof body.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
      return NextResponse.json({ error: 'due_date must be YYYY-MM-DD' }, { status: 400 });
    }
    updates.due_date = body.due_date;
  }
  if (body.fee_type !== undefined) {
    if (!(FEE_TYPES as readonly string[]).includes(body.fee_type)) {
      return NextResponse.json({ error: 'fee_type must be one of ' + FEE_TYPES.join(', ') }, { status: 400 });
    }
    updates.fee_type = body.fee_type;
  }
  if (body.description !== undefined) {
    updates.description = body.description === null ? null : String(body.description).slice(0, 1000);
  }
  if (wantsDiscount) {
    const d = body.discount_amount as number;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0) {
      return NextResponse.json({ error: 'discount_amount must be a non-negative number' }, { status: 400 });
    }
    const dReason = cleanReason(body.discount_reason);
    if (d > 0 && !dReason) return NextResponse.json({ error: 'discount_reason is required when a discount is applied' }, { status: 400 });
    const base = (updates.original_amount as number | undefined) ?? fee.original_amount ?? fee.amount;
    updates.original_amount = base;
    updates.discount_amount = d;
    updates.discount_reason = dReason;
    updates.discount_approved_by = staffId ?? userId;
    updates.amount = Math.max(0, Number(base) - d);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('fees').update(updates).eq('id', feeId).eq('school_id', schoolId)
    .select('id, status, amount, original_amount, due_date, fee_type, description, discount_amount, discount_reason, student_id')
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await writeAudit({
    schoolId, userId: userId ?? null, action: 'fee.amend', op: 'UPDATE', resourceId: feeId,
    oldData: fee, newData: updated,
    metadata: { reason, by_role: userRole, by_staff: staffId ?? null, fields: Object.keys(updates) },
    req,
  });

  return NextResponse.json({ fee: updated, audited: true });
}

// ─── DELETE (soft-cancel) ──────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, staffId, userId, userRole } = ctx;
  if (!(WRITE_ROLES as readonly string[]).includes(userRole)) {
    return NextResponse.json({ error: 'Your role cannot delete fees' }, { status: 403 });
  }

  const { id: feeId } = await params;
  if (!isUuid(feeId)) return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 });

  if (!(await isFeeModuleEnabled(schoolId))) {
    return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });
  }

  // Reason can arrive in the JSON body or as ?reason= for clients that can't send a DELETE body.
  let reason: string | null = null;
  try { const b = (await req.json()) as { reason?: string }; reason = cleanReason(b?.reason); } catch { /* no body */ }
  if (!reason) reason = cleanReason(req.nextUrl.searchParams.get('reason'));
  if (!reason) return NextResponse.json({ error: 'A reason (3–500 chars) is required to delete a fee' }, { status: 400 });

  const { data: fee, error: lookupErr } = await supabaseAdmin
    .from('fees')
    .select('id, status, amount, original_amount, due_date, fee_type, description, student_id, is_deleted')
    .eq('id', feeId).eq('school_id', schoolId).maybeSingle();
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!fee || fee.is_deleted) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  if ((SETTLED as readonly string[]).includes(fee.status)) {
    return NextResponse.json({ error: `Fee is ${fee.status} and cannot be deleted. Issue a refund/reversal instead.` }, { status: 409 });
  }

  const { error: delErr } = await supabaseAdmin
    .from('fees')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: staffId ?? userId, delete_reason: reason })
    .eq('id', feeId).eq('school_id', schoolId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  await writeAudit({
    schoolId, userId: userId ?? null, action: 'fee.delete', op: 'DELETE', resourceId: feeId,
    oldData: fee, newData: null,
    metadata: { reason, by_role: userRole, by_staff: staffId ?? null },
    req,
  });

  return NextResponse.json({ ok: true, audited: true });
}
