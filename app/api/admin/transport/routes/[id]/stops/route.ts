// app/api/admin/transport/routes/[id]/stops/route.ts
// Batch 4F — Stops for a route: GET, POST, DELETE via ?stop_id= param.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id: routeId } = await params;

  const { data: stops, error } = await supabaseAdmin
    .from('transport_stops')
    .select('*')
    .eq('route_id', routeId)
    .eq('school_id', schoolId)
    .order('stop_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Student count per stop
  const stopIds = (stops ?? []).map(s => s.id);
  const countMap: Record<string, number> = {};
  if (stopIds.length) {
    const { data: stCounts } = await supabaseAdmin
      .from('student_transport')
      .select('stop_id')
      .eq('school_id', schoolId)
      .eq('opted_in', true)
      .in('stop_id', stopIds);
    for (const r of stCounts ?? []) {
      if (r.stop_id) countMap[r.stop_id] = (countMap[r.stop_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({ stops: (stops ?? []).map(s => ({ ...s, student_count: countMap[s.id] ?? 0 })) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id: routeId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { stop_name, stop_order, pickup_time, dropoff_time, landmark } = body as {
    stop_name?: string; stop_order?: number; pickup_time?: string;
    dropoff_time?: string; landmark?: string;
  };
  if (!stop_name || stop_order == null) return NextResponse.json({ error: 'stop_name and stop_order required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('transport_stops')
    .insert({ route_id: routeId, school_id: schoolId, stop_name, stop_order, pickup_time: pickup_time ?? null, dropoff_time: dropoff_time ?? null, landmark: landmark ?? null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stop: data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id: routeId } = await params;
  const { searchParams } = new URL(req.url);
  const stopId = searchParams.get('stop_id');
  if (!stopId) return NextResponse.json({ error: 'stop_id required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('transport_stops')
    .delete()
    .eq('id', stopId)
    .eq('route_id', routeId)
    .eq('school_id', schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
