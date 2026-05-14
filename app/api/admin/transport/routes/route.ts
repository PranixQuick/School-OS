// app/api/admin/transport/routes/route.ts
// Batch 4F — Transport routes list + create.
// GET: routes with student count. POST: create new route.
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

  const { data: routes, error } = await supabaseAdmin
    .from('transport_routes')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('route_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Student counts per route
  const routeIds = (routes ?? []).map(r => r.id);
  const countMap: Record<string, number> = {};
  if (routeIds.length) {
    const { data: stCounts } = await supabaseAdmin
      .from('student_transport')
      .select('route_id')
      .eq('school_id', schoolId)
      .eq('opted_in', true)
      .in('route_id', routeIds);
    for (const r of stCounts ?? []) {
      countMap[r.route_id] = (countMap[r.route_id] ?? 0) + 1;
    }
  }

  const result = (routes ?? []).map(r => ({ ...r, student_count: countMap[r.id] ?? 0 }));
  return NextResponse.json({ routes: result });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { route_name, route_number, vehicle_reg, driver_name, driver_phone, capacity } = body as {
    route_name?: string; route_number?: string; vehicle_reg?: string;
    driver_name?: string; driver_phone?: string; capacity?: number;
  };
  if (!route_name) return NextResponse.json({ error: 'route_name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('transport_routes')
    .insert({ school_id: schoolId, route_name, route_number: route_number ?? null, vehicle_reg: vehicle_reg ?? null, driver_name: driver_name ?? null, driver_phone: driver_phone ?? null, capacity: capacity ?? 40 })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ route: data }, { status: 201 });
}
