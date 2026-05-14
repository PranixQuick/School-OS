// app/api/admin/transport/students/route.ts
// Batch 4F — Student transport assignments: list and assign/upsert.
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

  const { searchParams } = new URL(req.url);
  const routeId = searchParams.get('route_id');

  let query = supabaseAdmin
    .from('student_transport')
    .select('id, student_id, route_id, stop_id, opted_in, fee_amount, academic_year_id, students(name, class, section), transport_routes(route_name, route_number), transport_stops(stop_name, stop_order, pickup_time)')
    .eq('school_id', schoolId)
    .eq('opted_in', true)
    .order('students(name)');

  if (routeId) query = query.eq('route_id', routeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assignments = (data ?? []).map(a => {
    const st = Array.isArray(a.students) ? a.students[0] : a.students as { name?: string; class?: string; section?: string } | null;
    const route = Array.isArray(a.transport_routes) ? a.transport_routes[0] : a.transport_routes as { route_name?: string; route_number?: string } | null;
    const stop = Array.isArray(a.transport_stops) ? a.transport_stops[0] : a.transport_stops as { stop_name?: string; pickup_time?: string } | null;
    return {
      id: a.id, student_id: a.student_id, route_id: a.route_id, stop_id: a.stop_id,
      opted_in: a.opted_in, fee_amount: a.fee_amount,
      student_name: st?.name ?? '—', student_class: st?.class, student_section: st?.section,
      route_name: route?.route_name ?? '—', route_number: route?.route_number,
      stop_name: stop?.stop_name ?? null, pickup_time: stop?.pickup_time,
    };
  });

  return NextResponse.json({ assignments, count: assignments.length });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { student_id, route_id, stop_id, academic_year_id, fee_amount } = body as {
    student_id?: string; route_id?: string; stop_id?: string;
    academic_year_id?: string; fee_amount?: number;
  };
  if (!student_id || !route_id) return NextResponse.json({ error: 'student_id and route_id required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('student_transport')
    .upsert({
      school_id: schoolId, student_id, route_id,
      stop_id: stop_id ?? null,
      academic_year_id: academic_year_id ?? null,
      fee_amount: fee_amount ?? null,
      opted_in: true,
    }, { onConflict: 'school_id,student_id,academic_year_id' })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data }, { status: 201 });
}
