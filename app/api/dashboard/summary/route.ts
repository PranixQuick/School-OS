import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const [
      studentsRes,
      staffRes,
      feesRes,
      leadsCountRes,
      leadsDataRes,
      evalsCountRes,
      recordingsRes,
      eventsRes,
      narrativesRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', SCHOOL_ID)
        .eq('is_active', true),
      supabaseAdmin
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', SCHOOL_ID)
        .eq('is_active', true),
      supabaseAdmin
        .from('fees')
        .select('id, status, amount', { count: 'exact' })
        .eq('school_id', SCHOOL_ID)
        .in('status', ['pending', 'overdue']),
      // Separate count query for total_leads
      supabaseAdmin
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', SCHOOL_ID),
      // Separate data query for recent leads (top 5)
      supabaseAdmin
        .from('inquiries')
        .select('id, parent_name, child_name, child_age, target_class, source, score, priority, status, created_at')
        .eq('school_id', SCHOOL_ID)
        .order('score', { ascending: false })
        .limit(5),
      // Separate count for total evals done
      supabaseAdmin
        .from('recordings')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', SCHOOL_ID)
        .eq('status', 'done'),
      // Separate data query for recent evals (top 3)
      supabaseAdmin
        .from('recordings')
        .select('id, file_name, coaching_score, eval_report, status, uploaded_at, staff_id')
        .eq('school_id', SCHOOL_ID)
        .eq('status', 'done')
        .order('uploaded_at', { ascending: false })
        .limit(3),
      supabaseAdmin
        .from('events')
        .select('id, title, event_date, is_holiday, description')
        .eq('school_id', SCHOOL_ID)
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(4),
      supabaseAdmin
        .from('report_narratives')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', SCHOOL_ID),
    ]);

    const pendingFees = feesRes.data ?? [];
    const totalPendingAmount = pendingFees.reduce((sum, f) => sum + Number(f.amount ?? 0), 0);
    const highLeads = (leadsDataRes.data ?? []).filter(l => l.priority === 'high').length;

    return NextResponse.json({
      kpis: {
        total_students: studentsRes.count ?? 0,
        total_staff: staffRes.count ?? 0,
        pending_fees_count: feesRes.count ?? 0,
        pending_fees_amount: totalPendingAmount,
        total_leads: leadsCountRes.count ?? 0,
        high_priority_leads: highLeads,
        evals_done: evalsCountRes.count ?? 0,
        narratives_generated: narrativesRes.count ?? 0,
      },
      recent_leads: leadsDataRes.data ?? [],
      recent_evals: recordingsRes.data ?? [],
      upcoming_events: eventsRes.data ?? [],
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
