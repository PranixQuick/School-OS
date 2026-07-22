// app/api/dashboard/summary/route.ts
// School dashboard summary — KPIs, alerts, today attendance.
// Non-breaking: all existing fields preserved.
// Adds today_attendance object for principal/HM dashboard.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
    const schoolId = session.schoolId;
    const today = new Date().toISOString().split('T')[0];

    // Resolve school ids (supporting both UUID and legacy_school_id)
    const { data: inst } = await supabaseAdmin
      .from('institutions')
      .select('id, legacy_school_id, settings')
      .or(`id.eq.${schoolId},legacy_school_id.eq.${schoolId}`)
      .maybeSingle();

    const instId = inst?.id || schoolId;
    const legacyId = inst?.legacy_school_id;
    
    // Construct OR query for school_id
    const schoolOrFilter = `school_id.eq.${instId}${legacyId ? `,school_id.eq.${legacyId}` : ''}`;

    // Run all queries in parallel
    const [
      studentsRes, staffRes, feesRes, attRes, broadcastRes
    ] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).or(schoolOrFilter).eq('is_active', true),
      supabaseAdmin.from('staff').select('id', { count: 'exact', head: true }).or(schoolOrFilter).eq('is_active', true),
      supabaseAdmin.from('fees').select('amount, status').or(schoolOrFilter).in('status', ['pending','overdue']),
      supabaseAdmin.from('attendance').select('status, student_id').or(schoolOrFilter).eq('date', today),
      supabaseAdmin.from('broadcasts').select('id', { count: 'exact', head: true }).or(schoolOrFilter),
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
    const settings = (inst?.settings ?? {}) as Record<string, unknown>;
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
    console.error('[dashboard/summary]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
