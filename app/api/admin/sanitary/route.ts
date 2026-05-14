// app/api/admin/sanitary/route.ts
// Batch 4E — Sanitary inventory list + today's dispense count.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: items, error } = await supabaseAdmin
    .from('sanitary_inventory')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const inventoryIds = (items ?? []).map(i => i.id);

  // Today's dispense counts
  const dispensedToday: Record<string, number> = {};
  if (inventoryIds.length) {
    const { data: logs } = await supabaseAdmin
      .from('pad_dispensing_log')
      .select('inventory_id, quantity')
      .eq('school_id', schoolId)
      .gte('dispensed_at', today)
      .in('inventory_id', inventoryIds);
    for (const l of logs ?? []) {
      dispensedToday[l.inventory_id] = (dispensedToday[l.inventory_id] ?? 0) + l.quantity;
    }
  }

  const result = (items ?? []).map(i => ({
    ...i,
    today_dispensed: dispensedToday[i.id] ?? 0,
    low_stock: i.stock_count <= i.min_stock_alert,
  }));

  return NextResponse.json({ inventory: result });
}
