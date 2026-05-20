// app/api/anganwadi/mdm-stock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];
  const date  = req.nextUrl.searchParams.get('date') ?? today;

  const { data, error } = await supabaseAdmin
    .from('mdm_stock')
    .select('id, item_name, item_category, opening_stock, received_qty, consumed_qty, closing_stock, unit, min_threshold, shortage_alert, record_date')
    .eq('school_id', session.schoolId)
    .eq('record_date', date)
    .order('item_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stocks: data ?? [], date });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.item_name) return NextResponse.json({ error: 'item_name required' }, { status: 400 });

  const opening    = Number(body.opening_stock) || 0;
  const received   = Number(body.received_qty) || 0;
  const consumed   = Number(body.consumed_qty) || 0;
  const minThresh  = body.min_threshold ? Number(body.min_threshold) : null;
  const closing    = opening + received - consumed;
  const shortage   = minThresh !== null ? closing < minThresh : false;

  const { data, error } = await supabaseAdmin
    .from('mdm_stock')
    .upsert({
      school_id:     session.schoolId,
      item_name:     body.item_name as string,
      item_category: (body.item_category as string) ?? null,
      opening_stock: opening,
      received_qty:  received,
      consumed_qty:  consumed,
      unit:          (body.unit as string) ?? 'kg',
      record_date:   (body.record_date as string) ?? new Date().toISOString().split('T')[0],
      min_threshold: minThresh,
      shortage_alert: shortage,
    }, { onConflict: 'school_id,item_name,record_date' })
    .select('id, closing_stock').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id, closing_stock: data?.closing_stock, shortage_alert: shortage }, { status: 201 });
}
