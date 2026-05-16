// PATH: app/api/analytics/export/route.ts
// Data export endpoint for Power BI, Metabase, and any BI tool
// Returns structured JSON that can be consumed directly or via REST connector

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  const schoolId = getSchoolId(req);
  const dataset = req.nextUrl.searchParams.get('dataset') ?? 'overview';
  const format = req.nextUrl.searchParams.get('format') ?? 'json';
  const from = req.nextUrl.searchParams.get('from'); // ISO date filter
  const to = req.nextUrl.searchParams.get('to');

  try {
    let data: unknown;

    switch (dataset) {
      case 'overview': {
        // All KPIs in one payload — Power BI overview page
        const [students, staff, fees, leads, recordings, narratives, broadcasts, attendance, risk] = await Promise.all([
          supabaseAdmin.from('students').select('id, name, class, section, is_active, created_at').eq('school_id', schoolId),
          supabaseAdmin.from('staff').select('id, name, role, subject, is_active').eq('school_id', schoolId),
          supabaseAdmin.from('fees').select('id, student_id, fee_type, amount, status, due_date, paid_date').eq('school_id', schoolId),
          supabaseAdmin.from('inquiries').select('id, source, priority, status, score, target_class, created_at').eq('school_id', schoolId).is('deleted_at', null),
          supabaseAdmin.from('recordings').select('id, staff_id, coaching_score, status, uploaded_at').eq('school_id', schoolId),
          supabaseAdmin.from('report_narratives').select('id, student_id, term, status, generated_at').eq('school_id', schoolId),
          supabaseAdmin.from('broadcasts').select('id, type, target_count, sent_count, status, sent_at').eq('school_id', schoolId).is('deleted_at', null),
          supabaseAdmin.from('attendance').select('student_id, date, status').eq('school_id', schoolId).order('date', { ascending: false }).limit(10000),
          supabaseAdmin.from('student_risk_flags').select('student_id, risk_level, attendance_pct, avg_score, fee_overdue, flagged_at').eq('school_id', schoolId).is('resolved_at', null),
        ]);

        data = {
          exported_at: new Date().toISOString(),
          school_id: schoolId,
          dataset: 'overview',
          students: students.data ?? [],
          staff: staff.data ?? [],
          fees: fees.data ?? [],
          admissions_leads: leads.data ?? [],
          teacher_evaluations: recordings.data ?? [],
          report_narratives: narratives.data ?? [],
          broadcasts: broadcasts.data ?? [],
          attendance: attendance.data ?? [],
          risk_flags: risk.data ?? [],
          summary: {
            total_students: (students.data ?? []).filter(s => s.is_active).length,
            total_staff: (staff.data ?? []).filter(s => s.is_active).length,
            pending_fees: (fees.data ?? []).filter(f => f.status === 'pending' || f.status === 'overdue').length,
            total_leads: (leads.data ?? []).length,
            high_priority_leads: (leads.data ?? []).filter(l => l.priority === 'high').length,
            evals_done: (recordings.data ?? []).filter(r => r.status === 'done').length,
            reports_generated: (narratives.data ?? []).length,
            at_risk_students: (risk.data ?? []).length,
          },
        };
        break;
      }

      case 'attendance': {
        let query = supabaseAdmin.from('attendance').select('id, student_id, date, status, marked_by, students(name, class, section)').eq('school_id', schoolId).order('date', { ascending: false });
        if (from) query = query.gte('date', from);
        if (to) query = query.lte('date', to);
        const { data: rows } = await query.limit(50000);
        data = { exported_at: new Date().toISOString(), dataset: 'attendance', rows: rows ?? [] };
        break;
      }

      case 'fees': {
        const { data: rows } = await supabaseAdmin.from('fees').select('id, student_id, fee_type, amount, status, due_date, paid_date, students(name, class, section)').eq('school_id', schoolId).order('due_date', { ascending: false });
        data = { exported_at: new Date().toISOString(), dataset: 'fees', rows: rows ?? [] };
        break;
      }

      case 'admissions': {
        const { data: rows } = await supabaseAdmin.from('inquiries').select('id, parent_name, child_name, child_age, target_class, source, score, priority, status, created_at').eq('school_id', schoolId).is('deleted_at', null).order('created_at', { ascending: false });
        data = { exported_at: new Date().toISOString(), dataset: 'admissions', rows: rows ?? [] };
        break;
      }

      case 'evaluations': {
        const { data: rows } = await supabaseAdmin.from('recordings').select('id, staff_id, coaching_score, status, uploaded_at, processed_at, staff(name, role, subject)').eq('school_id', schoolId).order('uploaded_at', { ascending: false });
        data = { exported_at: new Date().toISOString(), dataset: 'evaluations', rows: rows ?? [] };
        break;
      }

      case 'risk': {
        const { data: rows } = await supabaseAdmin.from('student_risk_flags').select('id, student_id, risk_level, risk_factors, attendance_pct, avg_score, fee_overdue, flagged_at, resolved_at, students(name, class, section)').eq('school_id', schoolId).order('flagged_at', { ascending: false });
        data = { exported_at: new Date().toISOString(), dataset: 'risk', rows: rows ?? [] };
        break;
      }

      default:
        return NextResponse.json({
          error: `Unknown dataset: ${dataset}`,
          available_datasets: ['overview', 'attendance', 'fees', 'admissions', 'evaluations', 'risk'],
          usage: 'GET /api/analytics/export?dataset=overview',
          power_bi_tip: 'Use "Web" connector in Power BI Desktop. Enter the URL with your session cookie or API key.',
        }, { status: 400 });
    }

    // Set CORS headers so Power BI Desktop can fetch this
    const response = NextResponse.json(data);
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET');
    response.headers.set('Content-Disposition', `attachment; filename="edprosys-${dataset}-${new Date().toISOString().split('T')[0]}.json"`);
    return response;

  } catch (err) {
    console.error('Analytics export error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
