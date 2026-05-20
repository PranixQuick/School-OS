// app/api/dashboard/summary/route.ts
// School dashboard summary — KPIs, alerts, today attendance.
// Non-breaking: all existing fields preserved.
// Adds today_attendance object for principal/HM dashboard.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId, MissingSchoolIdError } from '@/lib/getSchoolId';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const today = new Date().toISOString().split('T')[0];

    // Run all queries in parallel
    const [
      studentsRes, staffRes, feesRes, attRes, broadcastRes, schoolRes
    ] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
      supabaseAdmin.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
      supabaseAdmin.from('fees').select('amount, status').eq('school_id', schoolId).in('status', ['pending','overdue']),
      supabaseAdmin.from('attendance').select('status, student_id').eq('school_id', schoolId).eq('date', today),
      supabaseAdmin.from('broadcasts').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabaseAdmin.from('institutions').select('settings').eq('legacy_school_id', schoolId).maybeSingle(),
    ]);

    const totalStudents = studentsRes.count ?? 0;
    const totalStaff    = staffRes.count ?? 0;
    const feeRows       = feesRes.data ?? [];
    const pendingFeesAmount = feeRows.reduce((s, f) => s + Number(f.amount), 0);
    const pendingFeesCount  = feeRows.length;

    // Today's attendance summary
    const attRows    = attRes.data ?? [];
    const present    = attRows.filter(r => r.status === 'present').length;
    const absent     = attRows.filter(r => r.status === 'absent').length;
    const totalMarked = attRows.length;
    const presentPct = totalMarked > 0 ? Math.round(100 * present / totalMarked) : null;

    // Get school_mode from settings
    const settings = (schoolRes.data?.settings ?? {}) as Record<string, unknown>;
    const schoolMode = (settings.school_mode as string) ?? null;
    const isGovt = schoolMode === 'govt_high_school' || schoolMode === 'govt_primary' || schoolMode === 'anganwadi';

    return NextResponse.json({
      // Existing fields — UNCHANGED for backward compatibility
      total_students:      totalStudents,
      total_staff:         totalStaff,
      pending_fees_count:  pendingFeesCount,
      pending_fees_amount: pendingFeesAmount,
      total_broadcasts:    broadcastRes.count ?? 0,

      // New: today attendance summary (non-null for all schools)
      today_attendance: {
        date:          today,
        present:       present,
        absent:        absent,
        total_marked:  totalMarked,
        total_students: totalStudents,
        present_pct:   presentPct,
        // Show alert banner when govt mode + classes with no attendance yet
        show_alert:    isGovt && totalMarked < totalStudents,
      },

      // School mode context
      school_mode: schoolMode,
      is_govt:     isGovt,
    });

  } catch (err) {
    if (err instanceof MissingSchoolIdError) return NextResponse.json({ error: 'No session' }, { status: 401 });
    console.error('[dashboard/summary]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
