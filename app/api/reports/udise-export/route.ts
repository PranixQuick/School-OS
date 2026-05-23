// app/api/reports/udise-export/route.ts
// Bible Phase 7 Step 7.2: Comprehensive UDISE+ export.
//
// Extends the existing dise-enrolment report (app/api/reports/govt/dise-enrolment)
// with all UDISE+ required sections:
//   1. Enrollment by Class × Gender × Category (existing)
//   2. Teacher deployment (staff with qualifications)
//   3. Infrastructure inventory
//   4. Dropout data
//   5. MDM/Mid-Day Meal compliance
//   6. APAAR coverage statistics
//
// GET /api/reports/udise-export?format=json (default)
// GET /api/reports/udise-export?format=csv (downloads CSV)
//
// Only accessible to admin, principal, deo, meo roles.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  if (!['admin', 'principal', 'deo', 'meo', 'super_admin'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Insufficient role for UDISE+ export' }, { status: 403 });
  }

  const schoolId = session.schoolId;
  const format = req.nextUrl.searchParams.get('format') ?? 'json';

  try {
    // ── Section 1: Enrollment by Class × Gender ─────────────────────────
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, class, section, gender, socioeconomic_category, rte_category, is_active, apaar_id')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    const activeStudents = students ?? [];
    const enrollmentByClass: Record<string, { boys: number; girls: number; total: number }> = {};
    for (const s of activeStudents) {
      const cls = s.class ?? 'Unknown';
      if (!enrollmentByClass[cls]) enrollmentByClass[cls] = { boys: 0, girls: 0, total: 0 };
      enrollmentByClass[cls].total++;
      const g = (s.gender ?? '').toUpperCase();
      if (g === 'M' || g === 'MALE' || g === 'BOY') enrollmentByClass[cls].boys++;
      else if (g === 'F' || g === 'FEMALE' || g === 'GIRL') enrollmentByClass[cls].girls++;
    }

    // ── Section 2: Teacher Deployment ───────────────────────────────────
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, name, designation, qualification, subject, gender, is_active')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    const activeStaff = staff ?? [];
    const teacherSummary = {
      total: activeStaff.length,
      male: activeStaff.filter(s => ['M', 'MALE'].includes((s.gender ?? '').toUpperCase())).length,
      female: activeStaff.filter(s => ['F', 'FEMALE'].includes((s.gender ?? '').toUpperCase())).length,
      by_designation: {} as Record<string, number>,
      by_qualification: {} as Record<string, number>,
    };
    for (const s of activeStaff) {
      const d = s.designation ?? 'Unknown';
      teacherSummary.by_designation[d] = (teacherSummary.by_designation[d] ?? 0) + 1;
      const q = s.qualification ?? 'Unknown';
      teacherSummary.by_qualification[q] = (teacherSummary.by_qualification[q] ?? 0) + 1;
    }

    // ── Section 3: Infrastructure ──────────────────────────────────────
    const { data: infraItems } = await supabaseAdmin
      .from('infrastructure')
      .select('item_name, category, status, quantity')
      .eq('school_id', schoolId);

    const infrastructure = {
      total_items: (infraItems ?? []).length,
      by_category: {} as Record<string, number>,
      items_needing_repair: (infraItems ?? []).filter(i => i.status === 'needs_repair' || i.status === 'damaged').length,
    };
    for (const item of infraItems ?? []) {
      const cat = item.category ?? 'Other';
      infrastructure.by_category[cat] = (infrastructure.by_category[cat] ?? 0) + (item.quantity ?? 1);
    }

    // ── Section 4: Dropout Data ────────────────────────────────────────
    const { data: inactiveStudents } = await supabaseAdmin
      .from('students')
      .select('id, class, gender, socioeconomic_category')
      .eq('school_id', schoolId)
      .eq('is_active', false);

    const dropouts = {
      total: (inactiveStudents ?? []).length,
      by_class: {} as Record<string, number>,
      by_gender: { male: 0, female: 0, other: 0 },
    };
    for (const s of inactiveStudents ?? []) {
      const cls = s.class ?? 'Unknown';
      dropouts.by_class[cls] = (dropouts.by_class[cls] ?? 0) + 1;
      const g = (s.gender ?? '').toUpperCase();
      if (g === 'M' || g === 'MALE' || g === 'BOY') dropouts.by_gender.male++;
      else if (g === 'F' || g === 'FEMALE' || g === 'GIRL') dropouts.by_gender.female++;
      else dropouts.by_gender.other++;
    }

    // ── Section 5: MDM Compliance ──────────────────────────────────────
    // Uses meal attendance data if available
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const { count: mealDaysCount } = await supabaseAdmin
      .from('attendance')
      .select('date', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('date', thirtyDaysAgo);

    const mdm = {
      meal_days_last_30: mealDaysCount ?? 0,
      note: 'Detailed MDM stock data available via /api/reports/icds/monthly-summary for anganwadi institutions',
    };

    // ── Section 6: APAAR Coverage ──────────────────────────────────────
    const apaarAssigned = activeStudents.filter(s => !!s.apaar_id).length;
    const apaar = {
      total_students: activeStudents.length,
      apaar_assigned: apaarAssigned,
      apaar_missing: activeStudents.length - apaarAssigned,
      coverage_pct: activeStudents.length > 0
        ? Math.round((apaarAssigned / activeStudents.length) * 100)
        : 0,
    };

    // ── Assemble report ────────────────────────────────────────────────
    const report = {
      report_type: 'UDISE+',
      report_date: today.toISOString().split('T')[0],
      school_id: schoolId,
      school_name: session.schoolName ?? '',
      sections: {
        enrollment: {
          total: activeStudents.length,
          by_class: enrollmentByClass,
        },
        teachers: teacherSummary,
        infrastructure,
        dropouts,
        mdm,
        apaar_coverage: apaar,
      },
    };

    if (format === 'csv') {
      // Simple CSV summary — one section per block
      const BOM = '\uFEFF';
      const lines: string[] = [
        `UDISE+ Report — ${report.school_name} — ${report.report_date}`,
        '',
        'Section 1: Enrollment',
        'Class,Boys,Girls,Total',
        ...Object.entries(enrollmentByClass).map(([cls, v]) => `${cls},${v.boys},${v.girls},${v.total}`),
        `Total,,, ${activeStudents.length}`,
        '',
        'Section 2: Teachers',
        `Total Staff,${teacherSummary.total}`,
        `Male,${teacherSummary.male}`,
        `Female,${teacherSummary.female}`,
        '',
        'Section 3: Infrastructure',
        `Total Items,${infrastructure.total_items}`,
        `Needing Repair,${infrastructure.items_needing_repair}`,
        '',
        'Section 4: Dropouts',
        `Total Inactive,${dropouts.total}`,
        '',
        'Section 5: APAAR Coverage',
        `Assigned,${apaar.apaar_assigned}`,
        `Missing,${apaar.apaar_missing}`,
        `Coverage,${apaar.coverage_pct}%`,
      ];

      return new NextResponse(BOM + lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="udise_export_${report.report_date}.csv"`,
        },
      });
    }

    return NextResponse.json(report);

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
