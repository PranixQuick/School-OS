// app/api/admin/timetable/route.ts
// Timetable management: list and create entries.
// GET: ?class_id=X (optional filter)
// POST: { class_id, subject_id, staff_id, day_of_week, start_time, end_time, period? }
// NOTE: timetable.period is smallint (not period_number).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ─── GET: list timetable ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const classId = req.nextUrl.searchParams.get('class_id');

  let query = supabaseAdmin
    .from('timetable')
    .select(`
      id, class_id, subject_id, staff_id,
      day_of_week, period, start_time, end_time,
      classes:class_id ( grade_level, section ),
      subjects:subject_id ( name ),
      staff:staff_id ( name )
    `)
    .eq('school_id', schoolId)
    .order('class_id').order('day_of_week').order('start_time');

  if (classId && isUuid(classId)) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ timetable: data ?? [], count: (data ?? []).length });
}

// ─── POST: create timetable entry ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { class_id, subject_id, staff_id, day_of_week, start_time, end_time, period } = body as Record<string, unknown>;

  if (!isUuid(class_id)) return NextResponse.json({ error: 'class_id (uuid) required' }, { status: 400 });
  if (!isUuid(subject_id)) return NextResponse.json({ error: 'subject_id (uuid) required' }, { status: 400 });
  if (!isUuid(staff_id)) return NextResponse.json({ error: 'staff_id (uuid) required' }, { status: 400 });
  if (day_of_week == null || typeof day_of_week !== 'number') return NextResponse.json({ error: 'day_of_week (0=Sun, 1=Mon, …) required' }, { status: 400 });
  if (!start_time || typeof start_time !== 'string') return NextResponse.json({ error: 'start_time (HH:MM) required' }, { status: 400 });
  if (!end_time || typeof end_time !== 'string') return NextResponse.json({ error: 'end_time (HH:MM) required' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('timetable').insert({
    school_id: schoolId,
    class_id, subject_id, staff_id,
    day_of_week, start_time, end_time,
    period: period ?? null,
  }).select(`
    id, class_id, subject_id, staff_id, day_of_week, period, start_time, end_time,
    classes:class_id ( grade_level, section ),
    subjects:subject_id ( name ),
    staff:staff_id ( name )
  `).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
