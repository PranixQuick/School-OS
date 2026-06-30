// app/api/principal/dashboard/route.ts
// Principal dashboard API — real-time decision-focused KPIs.
// FIX: Added MissingSchoolIdError → 401 (was throwing 500).
// FIX: Graceful degradation for tables that may have no data.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  let schoolId: string;
  try {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
    schoolId = session.schoolId;
  } catch {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [studentsRes, attendanceTodayRes, attendanceMonthRes, feesRes, feesPaidMonthRes,
      leadsRes, admittedRes, upcomingEventsRes] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
      supabaseAdmin.from('attendance').select('student_id, status').eq('school_id', schoolId).eq('date', today),
      supabaseAdmin.from('attendance').select('date, status').eq('school_id', schoolId).gte('date', thisMonthStart),
      supabaseAdmin.from('fees').select('amount, status, student_id').eq('school_id', schoolId).in('status', ['pending', 'overdue']),
      supabaseAdmin.from('fees').select('amount').eq('school_id', schoolId).eq('status', 'paid').gte('paid_date', thisMonthStart),
      supabaseAdmin.from('inquiries').select('id, priority, status, score, parent_name, created_at').eq('school_id', schoolId).is('deleted_at', null).gte('created_at', thirtyDaysAgo).order('score', { ascending: false }).limit(20),
      supabaseAdmin.from('inquiries').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'admitted').gte('created_at', thisMonthStart),
      supabaseAdmin.from('events').select('title, event_date, is_holiday').eq('school_id', schoolId).gte('event_date', today).lte('event_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]).order('event_date').limit(5),
    ]);

    // Optional tables — graceful degradation
    const [riskRes, evalsRes, teacherAttRes, briefingRes] = await Promise.allSettled([
      supabaseAdmin.from('student_risk_flags').select('risk_level, student_id').eq('school_id', schoolId).is('resolved_at', null).limit(20),
      supabaseAdmin.from('recordings').select('coaching_score, staff_id, uploaded_at').eq('school_id', schoolId).eq('status', 'done').gte('uploaded_at', sevenDaysAgo).limit(20),
      supabaseAdmin.from('teacher_attendance').select('staff_id, status').eq('school_id', schoolId).eq('date', today),
      supabaseAdmin.from('principal_briefings').select('briefing_text, generated_at').eq('school_id', schoolId).eq('date', today).maybeSingle(),
    ]);

    const totalStudents = studentsRes.count ?? 0;
    const todayAtt = attendanceTodayRes.data ?? [];
    const presentToday = todayAtt.filter(a => a.status === 'present').length;
    const attendancePct = todayAtt.length > 0 ? Math.round((presentToday / todayAtt.length) * 100) : null;
    const monthAtt = attendanceMonthRes.data ?? [];
    const dailyTotals: Record<string, { present: number; total: number }> = {};
    monthAtt.forEach(r => {
      if (!dailyTotals[r.date]) dailyTotals[r.date] = { present: 0, total: 0 };
      dailyTotals[r.date].total++;
      if (r.status === 'present') dailyTotals[r.date].present++;
    });
    const dailyPcts = Object.values(dailyTotals).map(d => Math.round((d.present / d.total) * 100));
    const monthAvgAttendance = dailyPcts.length > 0 ? Math.round(dailyPcts.reduce((s, p) => s + p, 0) / dailyPcts.length) : 0;
    const pendingFees = feesRes.data ?? [];
    const totalPending = pendingFees.reduce((s, f) => s + Number(f.amount), 0);
    const overdueCount = pendingFees.filter(f => f.status === 'overdue').length;
    const totalPaidMonth = (feesPaidMonthRes.data ?? []).reduce((s, f) => s + Number(f.amount), 0);
    const totalFeeTarget = totalPending + totalPaidMonth;
    const collectionPct = totalFeeTarget > 0 ? Math.round((totalPaidMonth / totalFeeTarget) * 100) : 100;
    const risks = riskRes.status === 'fulfilled' ? (riskRes.value.data ?? []) : [];
    const riskBreakdown = {
      critical: risks.filter((r: {risk_level: string}) => r.risk_level === 'critical').length,
      high: risks.filter((r: {risk_level: string}) => r.risk_level === 'high').length,
      medium: risks.filter((r: {risk_level: string}) => r.risk_level === 'medium').length,
      total: risks.length,
    };
    const leads = leadsRes.data ?? [];
    const admissionFunnel = {
      total_30d: leads.length, new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      high_priority: leads.filter(l => l.priority === 'high').length,
      admitted_month: admittedRes.count ?? 0,
    };
    const evals = evalsRes.status === 'fulfilled' ? (evalsRes.value.data ?? []) : [];
    const teacherAtt = teacherAttRes.status === 'fulfilled' ? (teacherAttRes.value.data ?? []) : [];
    const briefing = briefingRes.status === 'fulfilled' ? briefingRes.value.data : null;

    return NextResponse.json({
      as_of: new Date().toISOString(), today,
      total_students: totalStudents,
      attendance: {
        today_pct: attendancePct, today_present: presentToday, today_total: todayAtt.length,
        today_marked: todayAtt.length > 0, month_avg_pct: monthAvgAttendance,
        status: attendancePct === null ? 'not_marked' : attendancePct >= 85 ? 'good' : attendancePct >= 70 ? 'warning' : 'critical',
      },
      fees: {
        pending_amount: totalPending, pending_students: pendingFees.length,
        overdue_count: overdueCount, collected_month: totalPaidMonth,
        collection_pct: collectionPct,
        status: collectionPct >= 80 ? 'good' : collectionPct >= 60 ? 'warning' : 'critical',
      },
      risk: riskBreakdown,
      admissions: admissionFunnel,
      teachers: {
        present_today: teacherAtt.filter((t: {status: string}) => t.status === 'present').length,
        total_tracked: teacherAtt.length,
        evals_this_week: evals.length,
      },
      upcoming_events: upcomingEventsRes.data ?? [],
      briefing,
    });
  } catch (err) {
    console.error('Principal dashboard error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
