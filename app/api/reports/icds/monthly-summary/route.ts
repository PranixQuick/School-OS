// app/api/reports/icds/monthly-summary/route.ts
// ICDS Monthly Summary Report — for CDPO submission.
// Reads from v_icds_monthly_summary materialized view.
// Accessible to anganwadi supervisor + admin.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const format = req.nextUrl.searchParams.get('format') ?? 'json';

  // Fetch from v_icds_monthly_summary for this school
  const { data: summary, error } = await supabaseAdmin
    .from('v_icds_monthly_summary')
    .select('*')
    .eq('school_id', session.schoolId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!summary) return NextResponse.json({ error: 'No Anganwadi data found' }, { status: 404 });

  const today = new Date().toISOString().split('T')[0];

  if (format === 'csv') {
    const BOM = '\uFEFF';
    const lines = [
      `ICDS Monthly Report,${summary.center_name},${summary.icds_code ?? '—'}`,
      `Report Month,${summary.report_month}`,
      `Generated,${today}`,
      '',
      'CHILD ENROLLMENT',
      `Total Children Enrolled,${summary.children_enrolled}`,
      `Age 0-3 years,${summary.age_0_3}`,
      `Age 3-6 years,${summary.age_3_6}`,
      '',
      'ATTENDANCE',
      `Attendance % (This Month),${summary.attendance_pct_month ?? 0}%`,
      '',
      'MALNUTRITION STATUS (Last 35 Days)',
      `SAM (Severe),${summary.sam_count}`,
      `MAM (Moderate),${summary.mam_count}`,
      `Normal,${summary.normal_count}`,
      '',
      'IMMUNIZATION',
      `Vaccinations Administered,${summary.vaccinations_done}`,
      `Vaccinations Missed,${summary.vaccinations_missed}`,
      '',
      'BENEFICIARIES',
      `Pregnant Women (Active),${summary.pregnant_count}`,
      `Lactating Mothers (Active),${summary.lactating_count}`,
      '',
      'MDM STOCK',
      `Shortage Alerts (Last 7 Days),${summary.shortage_alerts_week}`,
    ];
    const csv = BOM + lines.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="icds_monthly_${today}.csv"`,
      },
    });
  }

  return NextResponse.json({ report_date: today, summary });
}
