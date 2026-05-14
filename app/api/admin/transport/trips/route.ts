// app/api/admin/transport/trips/route.ts
// Batch 4F — Create a trip and auto-populate trip_attendance rows.
// GET: today's trips for school. POST: create trip + attendance rows.
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
      try { const t = await requireTeacherSession(req); return { schoolId: t.schoolId, staffId: t.staffId, userRole: 'teacher' }; }
      catch {}
    }
    throw e;
  }
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await resolveSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const { data: trips, error } = await supabaseAdmin
    .from('transport_trips')
    .select('*, transport_routes(route_name, route_number, driver_name, driver_phone)')
    .eq('school_id', schoolId)
    .eq('trip_date', date)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attendance summary per trip
  const tripIds = (trips ?? []).map(t => t.id);
  const summary: Record<string, { expected: number; boarded: number; absent: number; unmarked: number }> = {};
  if (tripIds.length) {
    const { data: att } = await supabaseAdmin
      .from('trip_attendance')
      .select('trip_id, boarded')
      .in('trip_id', tripIds);
    for (const a of att ?? []) {
      if (!summary[a.trip_id]) summary[a.trip_id] = { expected: 0, boarded: 0, absent: 0, unmarked: 0 };
      summary[a.trip_id].expected++;
      if (a.boarded === true) summary[a.trip_id].boarded++;
      else if (a.boarded === false) summary[a.trip_id].absent++;
      else summary[a.trip_id].unmarked++;
    }
  }

  const result = (trips ?? []).map(t => {
    const route = Array.isArray(t.transport_routes) ? t.transport_routes[0] : t.transport_routes as { route_name?: string; route_number?: string; driver_name?: string; driver_phone?: string } | null;
    return { ...t, transport_routes: undefined, route_name: route?.route_name, route_number: route?.route_number, driver_name: route?.driver_name, driver_phone: route?.driver_phone, ...summary[t.id] };
  });

  return NextResponse.json({ trips: result, date });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await resolveSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { route_id, trip_date, trip_type } = body as { route_id?: string; trip_date?: string; trip_type?: string };
  if (!route_id || !trip_type) return NextResponse.json({ error: 'route_id and trip_type required' }, { status: 400 });

  // Create trip
  const { data: trip, error: tripErr } = await supabaseAdmin
    .from('transport_trips')
    .insert({ school_id: schoolId, route_id, trip_date: trip_date ?? new Date().toISOString().slice(0,10), trip_type, status: 'scheduled' })
    .select().single();
  if (tripErr) return NextResponse.json({ error: tripErr.message }, { status: 500 });

  // Auto-populate trip_attendance for all opted-in students on this route
  const { data: students } = await supabaseAdmin
    .from('student_transport')
    .select('student_id')
    .eq('school_id', schoolId)
    .eq('route_id', route_id)
    .eq('opted_in', true);

  const attRows = (students ?? []).map(s => ({
    trip_id: trip.id, student_id: s.student_id, school_id: schoolId, boarded: null,
  }));
  if (attRows.length) {
    await supabaseAdmin.from('trip_attendance').insert(attRows);
  }

  return NextResponse.json({ trip, students_expected: attRows.length }, { status: 201 });
}
