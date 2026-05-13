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
  return NextResponse.json(data);
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
