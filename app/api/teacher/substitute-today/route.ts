// app/api/teacher/substitute-today/route.ts
// Item #1 Track C Phase 4 — read-only substitute info for today.
// Item #10 update: filter by date column (added in Item #10 migration) instead of
//   UTC range on assigned_at. More reliable for multi-timezone setups.
//
// GET /api/teacher/substitute-today
//   Returns:
//     - covering_for: assignments where this teacher is substitute_staff_id today
//     - covered_by:   assignments where this teacher is original_staff_id today

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function istTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireTeacherSession(req); }
  catch (e) {
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { staffId, schoolId } = ctx;
  const today = istTodayISO();

  const [coveringForRes, coveredByRes] = await Promise.all([
    supabaseAdmin
      .from('substitute_assignments')
      .select(`
        id, original_staff_id, original_class_id, status, reason, date,
        original_staff:original_staff_id ( name ),
        class:original_class_id ( grade_level, section )
      `)
      .eq('substitute_staff_id', staffId)
      .eq('school_id', schoolId)
      .eq('date', today)
      .neq('status', 'cancelled'),
    supabaseAdmin
      .from('substitute_assignments')
      .select(`
        id, substitute_staff_id, original_class_id, status, reason, date,
        substitute_staff:substitute_staff_id ( name ),
        class:original_class_id ( grade_level, section )
      `)
      .eq('original_staff_id', staffId)
      .eq('school_id', schoolId)
      .eq('date', today)
      .neq('status', 'cancelled'),
  ]);

  if (coveringForRes.error || coveredByRes.error) {
    return NextResponse.json(
      { error: coveringForRes.error?.message || coveredByRes.error?.message || 'Query failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    date: today,
    covering_for: coveringForRes.data ?? [],
    covered_by: coveredByRes.data ?? [],
  });
}
