// app/api/admin/timetable/[id]/route.ts
// Timetable entry: update (PUT) and delete (DELETE).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ─── PUT: update timetable entry ──────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid timetable id' }, { status: 400 });
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const allowed: (keyof typeof body)[] = ['class_id','subject_id','staff_id','day_of_week','start_time','end_time','period'] as never[];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if ((body as Record<string, unknown>)[key] !== undefined) update[key] = (body as Record<string, unknown>)[key];
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

  // Load existing row for tenant guard and conflict checks
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('timetable')
    .select('id, school_id, class_id, subject_id, staff_id, day_of_week, period, start_time, end_time')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
  if (existing.school_id !== schoolId) return NextResponse.json({ error: 'Timetable entry does not belong to your school' }, { status: 403 });

  const resolvedStaffId = (update.staff_id !== undefined ? update.staff_id : existing.staff_id) as string | null;
  const resolvedDayOfWeek = (update.day_of_week !== undefined ? update.day_of_week : existing.day_of_week) as number;
  const resolvedPeriod = (update.period !== undefined ? update.period : existing.period) as number;
  const resolvedSubjectId = (update.subject_id !== undefined ? update.subject_id : existing.subject_id) as string;
  const resolvedStartTime = (update.start_time !== undefined ? update.start_time : existing.start_time) as string;
  const resolvedEndTime = (update.end_time !== undefined ? update.end_time : existing.end_time) as string;

  let sharedPeriodNote: string | undefined;
  if (resolvedStaffId != null && resolvedStaffId !== '') {
    const { data: conflicts, error: conflictErr } = await supabaseAdmin
      .from('timetable')
      .select('id, class_id, subject_id, start_time, end_time, classes:class_id ( grade_level, section )')
      .eq('school_id', schoolId)
      .eq('staff_id', resolvedStaffId)
      .eq('day_of_week', resolvedDayOfWeek)
      .eq('period', resolvedPeriod);
      
    if (conflictErr) return NextResponse.json({ error: conflictErr.message }, { status: 500 });
    
    const otherConflicts = conflicts ? conflicts.filter(c => c.id !== id) : [];
    if (otherConflicts && otherConflicts.length > 0) {
      const isShared = otherConflicts.every(c =>
        c.subject_id === resolvedSubjectId &&
        c.start_time === resolvedStartTime &&
        c.end_time === resolvedEndTime
      );
      
      if (!isShared) {
        return NextResponse.json({
          error: 'This teacher is already assigned elsewhere at that day and period.'
        }, { status: 409 });
      }
      
      const otherClasses = otherConflicts.map((c: any) => {
        const cls = Array.isArray(c.classes) ? c.classes[0] : c.classes;
        return cls ? `${cls.grade_level}-${cls.section}` : 'Unknown Class';
      });
      sharedPeriodNote = `Sharing period with class ${otherClasses.join(', ')}`;
    }
  }

  const { data, error } = await supabaseAdmin.from('timetable').update(update)
    .eq('id', id).eq('school_id', schoolId)
    .select(`
      id, class_id, subject_id, staff_id, day_of_week, period, start_time, end_time,
      classes:class_id ( grade_level, section ),
      subjects:subject_id ( name ),
      staff:staff_id ( name )
    `).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404 });
  return NextResponse.json({ ...data, shared_period_note: sharedPeriodNote });
}

// ─── DELETE: remove timetable entry ──────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid timetable id' }, { status: 400 });
  let ctx; try { ctx = await requireAdminSession(_req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { error } = await supabaseAdmin.from('timetable').delete()
    .eq('id', id).eq('school_id', schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true, id });
}
