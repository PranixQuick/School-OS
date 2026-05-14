// app/api/admin/sanitary/[id]/restock/route.ts
// Batch 4E — Restock sanitary inventory.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { quantity } = body as { quantity?: number };
  if (!quantity || quantity <= 0) return NextResponse.json({ error: 'quantity must be > 0' }, { status: 400 });

  // Fetch current stock
  const { data: item } = await supabaseAdmin
    .from('sanitary_inventory').select('stock_count')
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });

  const { data: updated, error } = await supabaseAdmin
    .from('sanitary_inventory')
    .update({
      stock_count: item.stock_count + quantity,
      last_restocked_at: new Date().toISOString(),
      last_restocked_by: staffId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id).eq('school_id', schoolId)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inventory: updated });
}
