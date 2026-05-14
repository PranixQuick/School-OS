// app/api/admin/transport/trips/[id]/attendance/route.ts
// Batch 4F — Mark trip attendance. Queues dropoff notifications for boarded students.
// GET: current attendance roster. PATCH: mark boarded/absent.
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

export async function GET(
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
  const { schoolId } = ctx;
  const { id: tripId } = await params;

  const { data, error } = await supabaseAdmin
    .from('trip_attendance')
    .select('*, students(name, class, section, phone_parent)')
    .eq('trip_id', tripId)
    .eq('school_id', schoolId)
    .order('student_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const roster = (data ?? []).map(a => {
    const st = Array.isArray(a.students) ? a.students[0] : a.students as { name?: string; class?: string; section?: string } | null;
    return { id: a.id, student_id: a.student_id, boarded: a.boarded, boarded_at: a.boarded_at, student_name: st?.name ?? '—', student_class: st?.class, student_section: st?.section };
  });
  return NextResponse.json({ roster, trip_id: tripId });
}

export async function PATCH(
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
  const { id: tripId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { records } = body as { records?: { student_id: string; boarded: boolean }[] };
  if (!records?.length) return NextResponse.json({ error: 'records required' }, { status: 400 });

  // Fetch trip for type check
  const { data: trip } = await supabaseAdmin
    .from('transport_trips').select('trip_type, route_id')
    .eq('id', tripId).eq('school_id', schoolId).maybeSingle();

  const now = new Date().toISOString();
  let updated = 0;
  let notificationsQueued = 0;

  for (const r of records) {
    const { error } = await supabaseAdmin
      .from('trip_attendance')
      .update({ boarded: r.boarded, boarded_at: now, marked_by: staffId ?? null })
      .eq('trip_id', tripId)
      .eq('student_id', r.student_id)
      .eq('school_id', schoolId);
    if (!error) updated++;

    // Queue dropoff notification for boarded students
    if (trip?.trip_type === 'dropoff' && r.boarded) {
      try {
        const { data: student } = await supabaseAdmin
          .from('students').select('name, phone_parent').eq('id', r.student_id).maybeSingle();
        if (student?.phone_parent) {
          // Get stop name from student_transport
          const { data: st } = await supabaseAdmin
            .from('student_transport')
            .select('transport_stops(stop_name)')
            .eq('student_id', r.student_id)
            .eq('route_id', trip.route_id)
            .eq('school_id', schoolId)
            .maybeSingle();
          const stopName = (Array.isArray(st?.transport_stops) ? st.transport_stops[0] : st?.transport_stops as { stop_name?: string } | null)?.stop_name ?? 'their stop';
          await supabaseAdmin.from('notifications').insert({
            school_id: schoolId, type: 'alert',
            title: `${student.name} dropped off safely`,
            message: `${student.name} has been dropped off at ${stopName}.`,
            target_count: 1, module: 'transport', reference_id: tripId,
            status: 'pending', channel: 'whatsapp', attempts: 0,
          });
          notificationsQueued++;
        }
      } catch (_e) { /* non-fatal */ }
    }
  }

  // Mark trip in_progress if first batch
  if (trip?.trip_type) {
    await supabaseAdmin.from('transport_trips')
      .update({ status: 'in_progress', started_at: now })
      .eq('id', tripId).eq('status', 'scheduled');
  }

  return NextResponse.json({ updated, notifications_queued: notificationsQueued });
}
