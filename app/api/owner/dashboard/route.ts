// app/api/owner/dashboard/route.ts
// Batch 4C — Cross-school owner dashboard aggregates.
// supabaseAdmin intentional: owner needs data across school_id boundaries.
// fees.paid_date confirmed. attendance.status+date confirmed.

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
    return NextResponse.json({ institution_name: institutionName, total_schools: 0, aggregate: {}, schools: [] });
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  // Parallel fetch all aggregates
  const [studentsRes, staffRes, feesRes, attendanceRes] = await Promise.allSettled([
    // Students per school
    supabaseAdmin.from('students').select('school_id').in('school_id', schoolIds).eq('is_active', true),
    // Staff per school
    supabaseAdmin.from('staff').select('school_id').in('school_id', schoolIds).eq('is_active', true),
    // Fees for all schools
    supabaseAdmin.from('fees').select('school_id, amount, status, paid_date')
      .in('school_id', schoolIds),
    // Attendance today
    supabaseAdmin.from('attendance').select('school_id, status')
      .in('school_id', schoolIds).eq('date', today),
  ]);

  const students = studentsRes.status === 'fulfilled' ? (studentsRes.value.data ?? []) : [];
  const staff = staffRes.status === 'fulfilled' ? (staffRes.value.data ?? []) : [];
  const fees = feesRes.status === 'fulfilled' ? (feesRes.value.data ?? []) : [];
  const attendance = attendanceRes.status === 'fulfilled' ? (attendanceRes.value.data ?? []) : [];

  // Aggregate per school
  const schoolMap: Record<string, {
    students: number; staff: number;
    fees_collected_month: number; fees_outstanding: number;
    att_present: number; att_total: number;
  }> = {};

  for (const sid of schoolIds) {
    schoolMap[sid] = { students: 0, staff: 0, fees_collected_month: 0, fees_outstanding: 0, att_present: 0, att_total: 0 };
  }

  for (const s of students) schoolMap[s.school_id].students++;
  for (const s of staff) schoolMap[s.school_id].staff++;

  for (const f of fees) {
    if (!schoolMap[f.school_id]) continue;
    const amt = Number(f.amount ?? 0);
    if (f.status === 'paid' && f.paid_date >= monthStart) {
      schoolMap[f.school_id].fees_collected_month += amt;
    }
    if (f.status === 'pending' || f.status === 'overdue') {
      schoolMap[f.school_id].fees_outstanding += amt;
    }
  }

  for (const a of attendance) {
    if (!schoolMap[a.school_id]) continue;
    schoolMap[a.school_id].att_total++;
    if (a.status === 'present') schoolMap[a.school_id].att_present++;
  }

  // Build per-school array
  const schoolsOut = schools.map(s => {
    const m = schoolMap[s.school_id] ?? { students:0,staff:0,fees_collected_month:0,fees_outstanding:0,att_present:0,att_total:0 };
    const att_pct = m.att_total > 0 ? Math.round((m.att_present / m.att_total) * 100) : null;
    return {
      school_id: s.school_id,
      school_name: s.school_name,
      students: m.students,
      staff: m.staff,
      fees_collected_month: m.fees_collected_month,
      fees_outstanding: m.fees_outstanding,
      attendance_pct_today: att_pct,
    };
  });

  // Aggregate totals
  const aggregate = schoolsOut.reduce((acc, s) => ({
    total_students: acc.total_students + s.students,
    total_staff: acc.total_staff + s.staff,
    total_fees_collected_month: acc.total_fees_collected_month + s.fees_collected_month,
    total_fees_outstanding: acc.total_fees_outstanding + s.fees_outstanding,
  }), { total_students: 0, total_staff: 0, total_fees_collected_month: 0, total_fees_outstanding: 0 });

  return NextResponse.json({
    institution_name: institutionName,
    total_schools: schools.length,
    aggregate,
    schools: schoolsOut,
  });
}
