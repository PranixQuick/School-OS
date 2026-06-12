// app/api/owner/dashboard/route.ts
// Owner Dashboard — cross-school aggregates.
// supabaseAdmin intentional: owner needs data across school_id boundaries.
//
// CONTRACT: app/owner/page.tsx reads school_stats[], total_students, total_staff,
// total_pending_fees_amount, fee_collection_trend[]. A previous version returned
// { schools, aggregate } with different field names, so the page read undefined
// and rendered 0 for everything despite correct data. This route now returns the
// exact shape the page consumes (and keeps schools/aggregate for back-compat).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireOwnerSession, OwnerAuthError } from '@/lib/owner-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireOwnerSession(req); }
  catch (e) { if (e instanceof OwnerAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { institutionName, schools, schoolIds } = ctx;

  if (!schoolIds.length) {
    return NextResponse.json({
      institution_name: institutionName,
      total_schools: 0,
      total_students: 0, total_staff: 0, total_pending_fees_amount: 0,
      school_stats: [], fee_collection_trend: [],
      aggregate: {}, schools: [],
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const days30Ago = new Date(Date.now() - 30 * 86400000).toISOString();

  const [studentsRes, staffRes, feesRes, attendanceRes, admissionsRes, riskRes, planRes] = await Promise.allSettled([
    supabaseAdmin.from('students').select('school_id').in('school_id', schoolIds).eq('is_active', true),
    supabaseAdmin.from('staff').select('school_id').in('school_id', schoolIds).eq('is_active', true),
    supabaseAdmin.from('fees').select('school_id, amount, status, paid_date').in('school_id', schoolIds),
    supabaseAdmin.from('attendance').select('school_id, status').in('school_id', schoolIds).eq('date', today),
    supabaseAdmin.from('students').select('school_id').in('school_id', schoolIds).eq('is_active', true).gte('created_at', days30Ago),
    supabaseAdmin.from('student_risk_flags').select('school_id').in('school_id', schoolIds).eq('is_active', true),
    supabaseAdmin.from('schools').select('id, plan, is_active').in('id', schoolIds),
  ]);

  const students   = studentsRes.status   === 'fulfilled' ? (studentsRes.value.data   ?? []) : [];
  const staff      = staffRes.status      === 'fulfilled' ? (staffRes.value.data      ?? []) : [];
  const fees       = feesRes.status       === 'fulfilled' ? (feesRes.value.data       ?? []) : [];
  const attendance = attendanceRes.status === 'fulfilled' ? (attendanceRes.value.data ?? []) : [];
  const admissions = admissionsRes.status === 'fulfilled' ? (admissionsRes.value.data ?? []) : [];
  const risks      = riskRes.status       === 'fulfilled' ? (riskRes.value.data       ?? []) : [];
  const plans      = planRes.status       === 'fulfilled' ? (planRes.value.data       ?? []) : [];

  const planMap: Record<string, { plan: string; is_active: boolean }> = {};
  for (const p of plans) planMap[p.id] = { plan: p.plan ?? 'free', is_active: p.is_active !== false };

  type Acc = {
    students: number; staff: number;
    fees_collected_month: number; fees_outstanding: number;
    pending_fees: number; paid_fees: number;
    att_present: number; att_total: number;
    admissions_30d: number; risk_count: number;
  };
  const m: Record<string, Acc> = {};
  for (const sid of schoolIds) {
    m[sid] = { students: 0, staff: 0, fees_collected_month: 0, fees_outstanding: 0, pending_fees: 0, paid_fees: 0, att_present: 0, att_total: 0, admissions_30d: 0, risk_count: 0 };
  }

  for (const s of students)   if (m[s.school_id]) m[s.school_id].students++;
  for (const s of staff)      if (m[s.school_id]) m[s.school_id].staff++;
  for (const a of admissions) if (m[a.school_id]) m[a.school_id].admissions_30d++;
  for (const r of risks)      if (m[r.school_id]) m[r.school_id].risk_count++;

  for (const f of fees) {
    if (!m[f.school_id]) continue;
    const amt = Number(f.amount ?? 0);
    if (f.status === 'paid') {
      m[f.school_id].paid_fees++;
      if (f.paid_date && f.paid_date >= monthStart) m[f.school_id].fees_collected_month += amt;
    }
    if (f.status === 'pending' || f.status === 'overdue') {
      m[f.school_id].pending_fees++;
      m[f.school_id].fees_outstanding += amt;
    }
  }

  for (const a of attendance) {
    if (!m[a.school_id]) continue;
    m[a.school_id].att_total++;
    if (a.status === 'present') m[a.school_id].att_present++;
  }

  // Shape the page expects: school_stats[]
  const school_stats = schools.map(s => {
    const a = m[s.school_id];
    const totalFees = a.pending_fees + a.paid_fees;
    const fee_collection_pct = totalFees > 0 ? Math.round((a.paid_fees / totalFees) * 100) : 100;
    const attendance_today_pct = a.att_total > 0 ? Math.round((a.att_present / a.att_total) * 100) : null;
    return {
      school_id: s.school_id,
      school_name: s.school_name,
      plan: planMap[s.school_id]?.plan ?? 'free',
      is_active: planMap[s.school_id]?.is_active ?? true,
      students: a.students,
      staff: a.staff,
      pending_fees: a.pending_fees,
      pending_fees_amount: a.fees_outstanding,
      attendance_today_pct,
      fee_collection_pct,
      admissions_30d: a.admissions_30d,
      risk_count: a.risk_count,
    };
  });

  const total_students = school_stats.reduce((t, s) => t + s.students, 0);
  const total_staff = school_stats.reduce((t, s) => t + s.staff, 0);
  const total_pending_fees_amount = school_stats.reduce((t, s) => t + s.pending_fees_amount, 0);
  const total_fees_collected_month = schoolIds.reduce((t, sid) => t + m[sid].fees_collected_month, 0);

  // 6-month fee collection trend (paid fees by month).
  const trendBuckets: { label: string; key: string; amount: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trendBuckets.push({ label: d.toLocaleDateString('en-IN', { month: 'short' }), key: d.toISOString().slice(0, 7), amount: 0 });
  }
  for (const f of fees) {
    if (f.status === 'paid' && f.paid_date) {
      const k = String(f.paid_date).slice(0, 7);
      const bucket = trendBuckets.find(b => b.key === k);
      if (bucket) bucket.amount += Number(f.amount ?? 0);
    }
  }
  const fee_collection_trend = trendBuckets.map(b => ({ label: b.label, amount: b.amount }));

  return NextResponse.json({
    institution_name: institutionName,
    total_schools: schools.length,
    // Fields the page (app/owner/page.tsx) reads:
    total_students,
    total_staff,
    total_pending_fees_amount,
    school_stats,
    fee_collection_trend,
    // Back-compat for any other consumer of the previous shape:
    aggregate: {
      total_students,
      total_staff,
      total_fees_collected_month,
      total_fees_outstanding: total_pending_fees_amount,
    },
    schools: school_stats.map(s => ({
      school_id: s.school_id,
      school_name: s.school_name,
      students: s.students,
      staff: s.staff,
      fees_collected_month: m[s.school_id].fees_collected_month,
      fees_outstanding: s.pending_fees_amount,
      attendance_pct_today: s.attendance_today_pct,
    })),
  });
}
