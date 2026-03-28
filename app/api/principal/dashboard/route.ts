// PATH: app/api/principal/dashboard/route.ts
//
// Dedicated principal dashboard API — real-time decision-focused KPIs.
// Uses existing DB tables. No new architecture.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [
      studentsRes,
      attendanceTodayRes,
      attendanceMonthRes,
      feesRes,
      feesPaidMonthRes,
      riskRes,
      leadsRes,
      admittedRes,
      evalsRes,
      teacherAttRes,
      upcomingEventsRes,
      briefingRes,
    ] = await Promise.all([
      // Total active students
      supabaseAdmin.from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId).eq('is_active', true),

      // Today's attendance
      supabaseAdmin.from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId).eq('date', today),

      // This month's attendance for trend
      supabaseAdmin.from('attendance')
        .select('date, status')
        .eq('school_id', schoolId)
        .gte('date', thisMonthStart),

      // Pending + overdue fees
      supabaseAdmin.from('fees')
        .select('amount, status, fee_type, student_id')
        .eq('school_id', schoolId)
        .in('status', ['pending', 'overdue']),

      // Fees paid this month
      supabaseAdmin.from('fees')
        .select('amount')
        .eq('school_id', schoolId)
        .eq('status', 'paid')
        .gte('paid_date', thisMonthStart),

      // At-risk students (unresolved)
      supabaseAdmin.from('student_risk_flags')
        .select('risk_level, student_id, students(name, class, section), ai_summary, flagged_at')
        .eq('school_id', schoolId)
        .is('resolved_at', null)
        .order('risk_level', { ascending: false })
        .limit(10),

      // Admissions pipeline (last 30 days)
      supabaseAdmin.from('inquiries')
        .select('id, priority, status, score, parent_name, created_at')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .gte('created_at', thirtyDaysAgo)
        .order('score', { ascending: false }),

      // Admitted this month
      supabaseAdmin.from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'admitted')
        .gte('created_at', thisMonthStart),

      // Teacher evaluations last 7 days
      supabaseAdmin.from('recordings')
        .select('coaching_score, staff_id, staff(name), uploaded_at')
        .eq('school_id', schoolId)
        .eq('status', 'done')
        .gte('uploaded_at', sevenDaysAgo)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false }),

      // Teacher attendance today
      supabaseAdmin.from('teacher_attendance')
        .select('staff_id, status, staff(name)')
        .eq('school_id', schoolId)
        .eq('date', today),

      // Upcoming events (next 7 days)
      supabaseAdmin.from('events')
        .select('title, event_date, is_holiday')
        .eq('school_id', schoolId)
        .gte('event_date', today)
        .lte('event_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
        .order('event_date')
        .limit(5),

      // Today's briefing
      supabaseAdmin.from('principal_briefings')
        .select('briefing_text, kpi_snapshot, generated_at')
        .eq('school_id', schoolId)
        .eq('date', today)
        .maybeSingle(),
    ]);

    // ─── Compute KPIs ──────────────────────────────────────────────────────────

    const totalStudents = studentsRes.count ?? 0;
    const todayAtt = attendanceTodayRes.data ?? [];
    const presentToday = todayAtt.filter(a => a.status === 'present').length;
    const attendancePct = todayAtt.length > 0
      ? Math.round((presentToday / todayAtt.length) * 100)
      : null; // null = not marked yet

    // Monthly attendance trend (daily average)
    const monthAtt = attendanceMonthRes.data ?? [];
    const dailyTotals: Record<string, { present: number; total: number }> = {};
    monthAtt.forEach(r => {
      if (!dailyTotals[r.date]) dailyTotals[r.date] = { present: 0, total: 0 };
      dailyTotals[r.date].total++;
      if (r.status === 'present') dailyTotals[r.date].present++;
    });
    const dailyPcts = Object.values(dailyTotals).map(d => Math.round((d.present / d.total) * 100));
    const monthAvgAttendance = dailyPcts.length > 0
      ? Math.round(dailyPcts.reduce((s, p) => s + p, 0) / dailyPcts.length)
      : 0;

    // Fee collection
    const pendingFees = feesRes.data ?? [];
    const totalPending = pendingFees.reduce((s, f) => s + Number(f.amount), 0);
    const overdueCount = pendingFees.filter(f => f.status === 'overdue').length;
    const totalPaidMonth = (feesPaidMonthRes.data ?? []).reduce((s, f) => s + Number(f.amount), 0);
    const totalFeeTarget = totalPending + totalPaidMonth;
    const collectionPct = totalFeeTarget > 0
      ? Math.round((totalPaidMonth / totalFeeTarget) * 100)
      : 100;

    // Risk breakdown
    const risks = riskRes.data ?? [];
    const riskBreakdown = {
      critical: risks.filter(r => r.risk_level === 'critical').length,
      high: risks.filter(r => r.risk_level === 'high').length,
      medium: risks.filter(r => r.risk_level === 'medium').length,
      total: risks.length,
    };

    // Admissions funnel
    const leads = leadsRes.data ?? [];
    const admissionFunnel = {
      total_30d: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      visit_scheduled: leads.filter(l => l.status === 'visit_scheduled').length,
      high_priority: leads.filter(l => l.priority === 'high').length,
      admitted_month: admittedRes.count ?? 0,
      conversion_rate: leads.length > 0
        ? Math.round(((admittedRes.count ?? 0) / leads.length) * 100)
        : 0,
    };

    // Teacher performance
    const evals = evalsRes.data ?? [];
    const avgEvalScore = evals.length > 0
      ? Math.round(evals.reduce((s, e) => s + Number(e.coaching_score ?? 0), 0) / evals.length * 10) / 10
      : null;

    const teacherAtt = teacherAttRes.data ?? [];
    const teachersPresent = teacherAtt.filter(t => t.status === 'present').length;
    const teachersTotal = teacherAtt.length;

    // Absentee teachers today
    const absentTeachers = teacherAtt
      .filter(t => t.status === 'absent')
      .map(t => {
        const staffArr = t.staff as { name: string }[] | null;
        return Array.isArray(staffArr) ? staffArr[0]?.name ?? 'Unknown' : 'Unknown';
      });

    return NextResponse.json({
      as_of: new Date().toISOString(),
      today,

      // Attendance
      attendance: {
        today_pct: attendancePct,
        today_present: presentToday,
        today_total: todayAtt.length,
        today_marked: todayAtt.length > 0,
        month_avg_pct: monthAvgAttendance,
        status: attendancePct === null ? 'not_marked'
          : attendancePct >= 85 ? 'good'
          : attendancePct >= 70 ? 'warning'
          : 'critical',
      },

      // Fee collection
      fees: {
        pending_amount: totalPending,
        pending_students: pendingFees.length,
        overdue_count: overdueCount,
        collected_month: totalPaidMonth,
        collection_pct: collectionPct,
        status: collectionPct >= 80 ? 'good' : collectionPct >= 60 ? 'warning' : 'critical',
      },

      // At-risk students
      risk: {
        ...riskBreakdown,
        top_cases: risks.slice(0, 5).map(r => {
          const studArr = r.students as { name: string; class: string; section: string }[] | null;
          const stud = Array.isArray(studArr) ? studArr[0] : null;
          return {
            name: stud?.name ?? 'Unknown',
            class: `${stud?.class ?? '?'}-${stud?.section ?? '?'}`,
            risk_level: r.risk_level,
            summary: r.ai_summary,
            flagged_at: r.flagged_at,
          };
        }),
      },

      // Admissions
      admissions: admissionFunnel,

      // Teacher performance
      teachers: {
        present_today: teachersPresent,
        total_tracked: teachersTotal,
        absent_today: absentTeachers,
        avg_eval_score: avgEvalScore,
        evals_this_week: evals.length,
        status: teachersTotal > 0 && teachersPresent / teachersTotal < 0.8 ? 'warning' : 'good',
      },

      // Upcoming events
      upcoming_events: upcomingEventsRes.data ?? [],

      // Today's AI briefing (if generated)
      briefing: briefingRes.data ?? null,
    });

  } catch (err) {
    console.error('Principal dashboard error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
