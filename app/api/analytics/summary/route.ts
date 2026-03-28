import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    const [
      studentsRes, staffRes, reportsRes, evalsRes,
      leadsRes, broadcastsRes, riskRes, activityRes,
    ] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
      supabaseAdmin.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
      supabaseAdmin.from('report_narratives').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      supabaseAdmin.from('recordings').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'done'),
      supabaseAdmin.from('inquiries').select('id, priority, status', { count: 'exact' }).eq('school_id', schoolId),
      supabaseAdmin.from('broadcasts').select('id, sent_count').eq('school_id', schoolId),
      supabaseAdmin.from('student_risk_flags').select('risk_level').eq('school_id', schoolId).is('resolved_at', null),
      supabaseAdmin.from('activity_logs').select('action, module, created_at').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(10),
    ]);

    const leads = leadsRes.data ?? [];
    const broadcasts = broadcastsRes.data ?? [];
    const risks = riskRes.data ?? [];

    return NextResponse.json({
      totals: {
        students: studentsRes.count ?? 0,
        staff: staffRes.count ?? 0,
        reports_generated: reportsRes.count ?? 0,
        evaluations_done: evalsRes.count ?? 0,
        total_leads: leadsRes.count ?? 0,
        high_priority_leads: leads.filter(l => l.priority === 'high').length,
        broadcasts_sent: broadcasts.length,
        parents_reached: broadcasts.reduce((s, b) => s + (b.sent_count ?? 0), 0),
        at_risk_students: risks.length,
        critical_risk: risks.filter(r => r.risk_level === 'critical').length,
      },
      leads_by_status: {
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        visit_scheduled: leads.filter(l => l.status === 'visit_scheduled').length,
        admitted: leads.filter(l => l.status === 'admitted').length,
        lost: leads.filter(l => l.status === 'lost').length,
      },
      recent_activity: activityRes.data ?? [],
    });

  } catch (err) {
    console.error('Analytics error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
