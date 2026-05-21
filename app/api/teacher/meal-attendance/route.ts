// app/api/teacher/meal-attendance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  const mealType = req.nextUrl.searchParams.get('meal_type') ?? 'lunch';
  const { data, error } = await supabaseAdmin
    .from('meal_attendance')
    .select('student_id, meal_served, meal_type')
    .eq('school_id', session.schoolId)
    .eq('date', date)
    .eq('meal_type', mealType);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { records?: { student_id: string; meal_served: boolean; meal_type: string; date: string }[] } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.records?.length) return NextResponse.json({ error: 'records required' }, { status: 400 });
  const rows = body.records.map(r => ({
    school_id: session.schoolId,
    student_id: r.student_id,
    date: r.date,
    meal_served: r.meal_served,
    meal_type: r.meal_type,
    marked_by: session.userId,
  }));
  const { error } = await supabaseAdmin.from('meal_attendance').upsert(rows, { onConflict: 'school_id,student_id,date,meal_type' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const served = rows.filter(r => r.meal_served).length;
  return NextResponse.json({ success: true, total: rows.length, served });
}
