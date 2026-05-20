// app/api/reports/meo/compliance-export/route.ts
// MEO Mandal Compliance Report — CSV export.
// ?format=csv → CSV download (for DEO submission)
// ?format=json → JSON for dashboard consumption

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!['meo', 'deo', 'admin', 'owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'MEO or admin role required' }, { status: 403 });
  }

  const format = req.nextUrl.searchParams.get('format') ?? 'json';

  // Get mandal code
  let mandalCode: string | null = null;
  if (session.userRole === 'meo') {
    const { data: mapping } = await supabaseAdmin
      .from('meo_mandal_mapping')
      .select('mandal_code, mandal_name')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (mapping) mandalCode = mapping.mandal_code;
  } else {
    const { data: inst } = await supabaseAdmin
      .from('institutions')
      .select('settings')
      .eq('legacy_school_id', session.schoolId)
      .maybeSingle();
    const udise = (inst?.settings as Record<string, unknown>)?.udise_code as string | undefined;
    if (udise && udise.length >= 6) mandalCode = udise.substring(0, 6);
  }

  const query = supabaseAdmin
    .from('v_meo_school_summary')
    .select('school_name, udise_code, present_today, total_students, teachers_checked_in, total_teachers, teachers_late_today, compliance_score')
    .order('compliance_score', { ascending: true });

  if (mandalCode) query.eq('mandal_code', mandalCode);

  const { data: schools, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date().toISOString().split('T')[0];

  if (format === 'csv') {
    const BOM = '\uFEFF';
    const header = ['School Name','UDISE Code','Students Present','Total Students','Student Attendance %','Teachers Checked In','Total Teachers','Late Teachers','Compliance Score %'].join(',');
    const rows = (schools ?? []).map(s => [
      `"${s.school_name}"`,
      s.udise_code,
      s.present_today,
      s.total_students,
      s.total_students > 0 ? Math.round(100 * s.present_today / s.total_students) : 0,
      s.teachers_checked_in,
      s.total_teachers,
      s.teachers_late_today,
      s.compliance_score,
    ].join(','));
    const csv = BOM + [header, ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="meo_compliance_${today}.csv"`,
      },
    });
  }

  return NextResponse.json({ date: today, mandal_code: mandalCode, schools: schools ?? [] });
}
