// app/api/admin/timetable/route.ts
// Timetable management: list / create / update / delete entries.
// GET:    ?class_id=X (optional filter)
// POST:   { class_id, subject_id, staff_id, day_of_week, period, start_time, end_time }
// PATCH:  { id, subject_id?, staff_id?, day_of_week?, period?, start_time?, end_time? }
// DELETE: ?id=<uuid>
// NOTE: timetable.period is smallint NOT NULL. Unique constraints prevent a
// class or a teacher being double-booked for the same day+period.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const ENRICHED = `
    id, class_id, subject_id, staff_id, day_of_week, period, start_time, end_time,
    classes:class_id ( grade_level, section ),
    subjects:subject_id ( name ),
    staff:staff_id ( name )
  `;

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// Map a unique-constraint violation to a human-friendly message.
function conflictMessage(msg: string): string {
  if (/teacher/i.test(msg)) return 'This teacher is already assigned elsewhere at that day and period.';
  if (/class|period/i.test(msg)) return 'This class already has a period scheduled at that day and period.';
  return 'That timetable slot conflicts with an existing entry.';
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
  if (staff_id != null && staff_id !== '' && !isUuid(staff_id)) return NextResponse.json({ error: 'staff_id must be a uuid or null' }, { status: 400 });
  if (typeof day_of_week !== 'number') return NextResponse.json({ error: 'day_of_week (0=Sun, 1=Mon, …) required' }, { status: 400 });
  if (typeof period !== 'number') return NextResponse.json({ error: 'period (number) required' }, { status: 400 });
  if (!start_time || typeof start_time !== 'string') return NextResponse.json({ error: 'start_time (HH:MM) required' }, { status: 400 });
  if (!end_time || typeof end_time !== 'string') return NextResponse.json({ error: 'end_time (HH:MM) required' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('timetable').insert({
    school_id: schoolId,
    class_id, subject_id,
    staff_id: (typeof staff_id === 'string' && staff_id) ? staff_id : null,
    day_of_week, period, start_time, end_time,
  }).select(ENRICHED).single();

  if (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: conflictMessage(error.message) }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

// ─── PATCH: update an existing timetable entry ────────────────────────────────
export async function PATCH(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, subject_id, staff_id, day_of_week, period, start_time, end_time } = body as Record<string, unknown>;

  if (!isUuid(id)) return NextResponse.json({ error: 'id (uuid) required' }, { status: 400 });

  // Tenant guard: ensure the row belongs to this school before updating.
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('timetable').select('id, school_id').eq('id', id).maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
  if (existing.school_id !== schoolId) return NextResponse.json({ error: 'Timetable entry does not belong to your school' }, { status: 403 });

  const patch: Record<string, unknown> = {};
  if (subject_id !== undefined) { if (!isUuid(subject_id)) return NextResponse.json({ error: 'subject_id must be a uuid' }, { status: 400 }); patch.subject_id = subject_id; }
  if (staff_id !== undefined) { if (staff_id !== null && !isUuid(staff_id)) return NextResponse.json({ error: 'staff_id must be a uuid or null' }, { status: 400 }); patch.staff_id = staff_id; }
  if (day_of_week !== undefined) { if (typeof day_of_week !== 'number') return NextResponse.json({ error: 'day_of_week must be a number' }, { status: 400 }); patch.day_of_week = day_of_week; }
  if (period !== undefined) { if (typeof period !== 'number') return NextResponse.json({ error: 'period must be a number' }, { status: 400 }); patch.period = period; }
  if (start_time !== undefined) { if (typeof start_time !== 'string') return NextResponse.json({ error: 'start_time must be HH:MM' }, { status: 400 }); patch.start_time = start_time; }
  if (end_time !== undefined) { if (typeof end_time !== 'string') return NextResponse.json({ error: 'end_time must be HH:MM' }, { status: 400 }); patch.end_time = end_time; }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'no fields to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('timetable').update(patch).eq('id', id).eq('school_id', schoolId).select(ENRICHED).single();

  if (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: conflictMessage(error.message) }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// ─── DELETE: remove timetable entry by id ─────────────────────────────────────
export async function DELETE(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  if (!isUuid(id)) return NextResponse.json({ error: 'id must be a valid uuid' }, { status: 400 });

  // Tenant guard: ensure the row belongs to this school before deleting
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('timetable')
    .select('id, school_id')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
  if (existing.school_id !== schoolId) return NextResponse.json({ error: 'Timetable entry does not belong to your school' }, { status: 403 });

  const { error } = await supabaseAdmin
    .from('timetable')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
