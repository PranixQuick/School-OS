// app/api/admin/sanitary-inventory/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('sanitary_inventory')
    .select('*')
    .eq('school_id', session.schoolId)
    .order('item_type');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner','principal'].includes(session.userRole)) return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  let body: { item_name?: string; item_type?: string; stock_count?: number; min_stock_alert?: number } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.item_name) return NextResponse.json({ error: 'item_name required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('sanitary_inventory').insert({
    school_id: session.schoolId,
    item_name: body.item_name,
    item_type: body.item_type ?? 'other',
    stock_count: body.stock_count ?? 0,
    min_stock_alert: body.min_stock_alert ?? 10,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { id?: string; restock_qty?: number; stock_count?: number } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: current } = await supabaseAdmin.from('sanitary_inventory').select('stock_count').eq('id', body.id).eq('school_id', session.schoolId).single();
  if (!current) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const newCount = body.restock_qty !== undefined
    ? current.stock_count + body.restock_qty
    : (body.stock_count ?? current.stock_count);

  const { error } = await supabaseAdmin.from('sanitary_inventory').update({
    stock_count: newCount,
    last_restocked_at: body.restock_qty !== undefined ? new Date().toISOString() : undefined,
    last_restocked_by: session.userId,
    updated_at: new Date().toISOString(),
  }).eq('id', body.id).eq('school_id', session.schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, new_stock_count: newCount });
}
