// app/api/anganwadi/dashboard/route.ts
// Anganwadi operational dashboard API.
// Aggregates: growth summary, vaccine due, MDM stock, beneficiary alerts, supplement log.
// Scoped to school_id from session.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sid = session.schoolId;
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [schoolRes, growthRes, vaccineRes, mdmRes, benefRes, mealRes, suppRes] = await Promise.allSettled([
    // School info
    supabaseAdmin.from('schools').select('name').eq('id', sid).single(),
    // Growth summary — latest record per child
    supabaseAdmin.from('child_growth_records').select('malnutrition_cat, student_id').eq('school_id', sid),
    // Vaccines overdue
    supabaseAdmin.from('immunization_records')
      .select('student_id, vaccine_name, scheduled_date')
      .eq('school_id', sid)
      .eq('status', 'scheduled')
      .lt('scheduled_date', today)
      .order('scheduled_date'),
    // MDM stock
    supabaseAdmin.from('mdm_stock').select('item_name, closing_stock, min_threshold, shortage_alert').eq('school_id', sid),
    // Beneficiary alerts — pregnant/lactating
    supabaseAdmin.from('anganwadi_beneficiaries')
      .select('name, phone, beneficiary_type')
      .eq('school_id', sid)
      .in('beneficiary_type', ['pregnant', 'lactating']),
    // Meal marked today
    supabaseAdmin.from('meal_attendance').select('id').eq('school_id', sid).eq('date', today).limit(1),
    // Supplements distributed this month
    supabaseAdmin.from('nutrition_supplement_log').select('supplement_type').eq('school_id', sid).gte('distribution_date', firstOfMonth),
  ]);

  const school  = schoolRes.status === 'fulfilled' ? schoolRes.value.data : null;
  const growthRows = growthRes.status === 'fulfilled' ? (growthRes.value.data ?? []) : [];
  const vaccineRows = vaccineRes.status === 'fulfilled' ? (vaccineRes.value.data ?? []) : [];
  const mdmRows = mdmRes.status === 'fulfilled' ? (mdmRes.value.data ?? []) : [];
  const benefRows = benefRes.status === 'fulfilled' ? (benefRes.value.data ?? []) : [];
  const mealRows = mealRes.status === 'fulfilled' ? (mealRes.value.data ?? []) : [];
  const suppRows = suppRes.status === 'fulfilled' ? (suppRes.value.data ?? []) : [];

  // Growth summary
  const growth = {
    sam:    growthRows.filter(r => r.malnutrition_cat === 'SAM').length,
    mam:    growthRows.filter(r => r.malnutrition_cat === 'MAM').length,
    normal: growthRows.filter(r => r.malnutrition_cat === 'Normal' || !r.malnutrition_cat).length,
    total:  growthRows.length,
  };

  // Vaccines due — group by vaccine name
  const vaccByName: Record<string, { count: number; days: number[] }> = {};
  for (const v of vaccineRows) {
    if (!vaccByName[v.vaccine_name]) vaccByName[v.vaccine_name] = { count: 0, days: [] };
    vaccByName[v.vaccine_name].count++;
    const days = Math.ceil((new Date(today).getTime() - new Date(v.scheduled_date).getTime()) / 86400000);
    vaccByName[v.vaccine_name].days.push(days);
  }
  const vaccines_due = Object.entries(vaccByName).map(([vaccine_name, vd]) => ({
    name: vaccine_name, vaccine_name,
    count: vd.count,
    days_overdue: Math.max(...vd.days),
  })).sort((a, b) => b.days_overdue - a.days_overdue);

  // Supplement count
  const suppCount: Record<string, number> = {};
  for (const s of suppRows) {
    suppCount[s.supplement_type] = (suppCount[s.supplement_type] ?? 0) + 1;
  }
  const supplements_today = Object.entries(suppCount).map(([supplement_type, total_today]) => ({ supplement_type, total_today }));

  // AWW name from staff
  const { data: staffData } = await supabaseAdmin.from('staff').select('name').eq('school_id', sid).eq('role', 'teacher').limit(1);

  return NextResponse.json({
    center_name: school?.name ?? 'Anganwadi Center',
    aww_name: staffData?.[0]?.name ?? 'AWW',
    total_children: growth.total,
    attendance_today: 0, // filled by attendance API
    attendance_pct: 0,
    growth,
    vaccines_due,
    beneficiary_alerts: benefRows.map(b => ({ name: b.name, type: b.beneficiary_type, alert: b.beneficiary_type === 'pregnant' ? 'Prenatal checkup' : 'Lactation support', phone: b.phone })),
    mdm_stock: mdmRows,
    supplements_today,
    meal_marked_today: mealRows.length > 0,
    icds_report_due: new Date().getDate() <= 5, // ICDS report due first 5 days of month
  });
}
