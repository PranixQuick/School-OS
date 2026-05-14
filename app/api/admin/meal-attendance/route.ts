// app/api/admin/meal-attendance/route.ts
// Batch 4A — Mid-day meal attendance GET (roster with status) and POST (batch upsert).
// Guard: feature_flags.meal_tracking_enabled must be true.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function checkMealEnabled(schoolId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('schools').select('institutions(feature_flags)').eq('id', schoolId).maybeSingle();
  const inst = data ? (Array.isArray(data.institutions) ? data.institutions[0] : data.institutions) as { feature_flags?: Record<string, unknown> } | null : null;
  return !!(inst?.feature_flags?.meal_tracking_enabled);
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  if (!(await checkMealEnabled(schoolId))) {
    return NextResponse.json({ error: 'Meal tracking is not enabled for this institution' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const classFilter = searchParams.get('class');
  const section = searchParams.get('section');

  // Load students
  let studentQuery = supabaseAdmin.from('students').select('id, name, roll_number, class, section').eq('school_id', schoolId).eq('is_active', true);
  if (classFilter) studentQuery = studentQuery.eq('class', classFilter);
  if (section) studentQuery = studentQuery.eq('section', section);
  const { data: students } = await studentQuery;

  // Load meal attendance for date
  const ids = (students ?? []).map(s => s.id);
  let mealMap: Record<string, boolean> = {};
  if (ids.length) {
    const { data: meals } = await supabaseAdmin.from('meal_attendance').select('student_id, meal_served').eq('school_id', schoolId).eq('date', date).in('student_id', ids);
    mealMap = Object.fromEntries((meals ?? []).map(m => [m.student_id, m.meal_served]));
  }

  const roster = (students ?? []).map(s => ({
    student_id: s.id, name: s.name, roll_number: s.roll_number,
    class: s.class, section: s.section,
    meal_served: mealMap[s.id] ?? null, // null = not yet marked
  }));

  return NextResponse.json({ date, roster, total: roster.length, marked: Object.keys(mealMap).length });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;

  if (!(await checkMealEnabled(schoolId))) {
    return NextResponse.json({ error: 'Meal tracking is not enabled for this institution' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { date, records } = body as { date?: string; records?: { student_id: string; meal_served: boolean }[] };
  if (!date || !records?.length) return NextResponse.json({ error: 'date and records required' }, { status: 400 });

  const upsertRows = records.map(r => ({
    school_id: schoolId,
    student_id: r.student_id,
    date,
    meal_served: r.meal_served,
    marked_by: staffId ?? null,
  }));

  const { error } = await supabaseAdmin.from('meal_attendance')
    .upsert(upsertRows, { onConflict: 'school_id,student_id,date' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: upsertRows.length });
}
