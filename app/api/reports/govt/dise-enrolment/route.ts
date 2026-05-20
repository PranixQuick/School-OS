// app/api/reports/govt/dise-enrolment/route.ts
// DISE/UDISE Enrolment Report — Class × Category × Gender matrix.
// Telangana government format. CSV download.
// Only accessible to school_mode = govt_primary | govt_high_school.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId, MissingSchoolIdError } from '@/lib/getSchoolId';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const format   = req.nextUrl.searchParams.get('format') ?? 'json';

    // Fetch all active students with socioeconomic_category and gender
    const { data: students, error } = await supabaseAdmin
      .from('students')
      .select('class, section, gender, socioeconomic_category, rte_category, is_active')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!students) return NextResponse.json({ rows: [] });

    const CLASSES = ['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'];
    const CATEGORIES = ['OC','BC-A','BC-B','BC-C','BC-D','SC','ST','Minority','Other'];

    // Category normalizer
    function normalizeCategory(raw?: string | null): string {
      if (!raw) return 'OC';
      const u = raw.toUpperCase();
      if (u.includes('SC') && !u.includes('ST')) return 'SC';
      if (u.includes('ST')) return 'ST';
      if (u.includes('BC-A')) return 'BC-A';
      if (u.includes('BC-B')) return 'BC-B';
      if (u.includes('BC-C')) return 'BC-C';
      if (u.includes('BC-D')) return 'BC-D';
      if (u.includes('BC')) return 'BC-A';
      if (u.includes('MINOR')) return 'Minority';
      return 'OC';
    }

    // Build matrix: class → category → { boys, girls, total }
    const matrix: Record<string, Record<string, { boys: number; girls: number; total: number }>> = {};
    for (const cls of CLASSES) {
      matrix[cls] = {};
      for (const cat of CATEGORIES) {
        matrix[cls][cat] = { boys: 0, girls: 0, total: 0 };
      }
    }

    for (const s of students) {
      const cls = s.class ?? 'Other';
      const cat = normalizeCategory(s.socioeconomic_category);
      if (!matrix[cls]) continue;
      if (!matrix[cls][cat]) continue;
      const gender = (s.gender ?? '').toUpperCase();
      matrix[cls][cat].total++;
      if (gender === 'M' || gender === 'BOY' || gender === 'MALE') matrix[cls][cat].boys++;
      else if (gender === 'F' || gender === 'GIRL' || gender === 'FEMALE') matrix[cls][cat].girls++;
    }

    if (format === 'csv') {
      const BOM = '\uFEFF'; // UTF-8 BOM for Excel Telugu compatibility
      const header = ['Class', ...CATEGORIES.flatMap(c => [`${c}_Boys`, `${c}_Girls`, `${c}_Total`]), 'Grand_Total'].join(',');
      const rows = CLASSES
        .filter(cls => Object.values(matrix[cls] ?? {}).some(v => v.total > 0))
        .map(cls => {
          const grandTotal = Object.values(matrix[cls]).reduce((s, v) => s + v.total, 0);
          const cells = CATEGORIES.flatMap(cat => [matrix[cls][cat].boys, matrix[cls][cat].girls, matrix[cls][cat].total]);
          return [cls, ...cells, grandTotal].join(',');
        });
      const csv = BOM + [header, ...rows].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="dise_enrolment_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON response
    const rows = CLASSES
      .filter(cls => Object.values(matrix[cls] ?? {}).some(v => v.total > 0))
      .map(cls => ({
        class: cls,
        grand_total: Object.values(matrix[cls]).reduce((s, v) => s + v.total, 0),
        by_category: matrix[cls],
      }));

    return NextResponse.json({
      report_date: new Date().toISOString().split('T')[0],
      total_enrolled: students.length,
      rows,
    });

  } catch (err) {
    if (err instanceof MissingSchoolIdError) return NextResponse.json({ error: 'No session' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
