// app/api/admin/sanitary/[id]/dispense/route.ts
// Batch 4E — Dispense from sanitary inventory.
// Guard: stock >= quantity. Low-stock alert if drops to/below min_stock_alert.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError && e.status === 403) {
      try {
        const t = await requireTeacherSession(req);
        return { schoolId: t.schoolId, staffId: t.staffId, userRole: 'teacher' };
      } catch {}
    }
    throw e;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await resolveSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, staffId } = ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { student_id, quantity: rawQty, notes } = body as { student_id?: string; quantity?: number; notes?: string };
  const quantity = rawQty ?? 1;
  if (quantity <= 0) return NextResponse.json({ error: 'quantity must be > 0' }, { status: 400 });

  const { data: item } = await supabaseAdmin
    .from('sanitary_inventory').select('stock_count, min_stock_alert, item_name')
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
  if (item.stock_count < quantity) {
    return NextResponse.json({ error: `Insufficient stock (${item.stock_count} remaining)` }, { status: 400 });
  }

  const newCount = item.stock_count - quantity;

  // Update stock
  await supabaseAdmin.from('sanitary_inventory')
    .update({ stock_count: newCount, updated_at: new Date().toISOString() })
    .eq('id', id).eq('school_id', schoolId);

  // Log dispense
  await supabaseAdmin.from('pad_dispensing_log').insert({
    school_id: schoolId,
    student_id: student_id ?? null,
    inventory_id: id,
    dispensed_by: staffId ?? null,
    quantity,
    dispensed_at: new Date().toISOString(),
    notes: notes ?? null,
  });

  // Low-stock notification (non-fatal)
  if (newCount <= item.min_stock_alert) {
    try {
      await supabaseAdmin.from('notifications').insert({
        school_id: schoolId,
        type: 'alert',
        title: 'Low sanitary stock alert',
        message: `${item.item_name} stock is at ${newCount} units. Please restock.`,
        target_count: 1,
        module: 'sanitary',
        reference_id: id,
        status: 'pending',
        channel: 'whatsapp',
        attempts: 0,
      });
    } catch (_e) { /* non-fatal */ }
  }

  return NextResponse.json({ success: true, remaining_stock: newCount });
}
