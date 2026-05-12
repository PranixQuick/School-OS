// app/api/teacher/substitute-today/route.ts
// Item #1 Track C Phase 4 — read-only substitute info for today.
//
// GET /api/teacher/substitute-today
//   Returns:
//     - covering_for: assignments where this teacher is substitute_staff_id today
//     - covered_by:   assignments where this teacher is original_staff_id today
//                     (i.e., someone else is covering for them)
//
// Read-only per directive: Item #10 owns full substitute workflow. Phase 4
// only displays existing assignments.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function istTodayISO(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  return ist.getUTCFullYear() + '-' +
    String(ist.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(ist.getUTCDate()).padStart(2, '0');
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
  // Today range in UTC for assigned_at filtering
  const startOfDayIst = new Date(today + 'T00:00:00+05:30').toISOString();
  const endOfDayIst = new Date(today + 'T23:59:59+05:30').toISOString();

  const [coveringForRes, coveredByRes] = await Promise.all([
    supabaseAdmin
      .from('substitute_assignments')
      .select('id, original_staff_id, original_class_id, status, assigned_at, reason')
      .eq('substitute_staff_id', staffId)
      .eq('school_id', schoolId)
      .gte('assigned_at', startOfDayIst)
      .lte('assigned_at', endOfDayIst)
      .neq('status', 'cancelled'),
    supabaseAdmin
      .from('substitute_assignments')
      .select('id, substitute_staff_id, original_class_id, status, assigned_at, reason')
      .eq('original_staff_id', staffId)
      .eq('school_id', schoolId)
      .gte('assigned_at', startOfDayIst)
      .lte('assigned_at', endOfDayIst)
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
