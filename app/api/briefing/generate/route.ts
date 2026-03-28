import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', schoolId).single();
    const schoolName = school?.name ?? 'School';

    const [studentsRes, attendanceRes, feesRes, leadsRes, evalsRes, teacherAttRes, eventsRes] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
      supabaseAdmin.from('attendance').select('status').eq('school_id', schoolId).eq('date', today),
      supabaseAdmin.from('fees').select('amount, status').eq('school_id', schoolId).in('status', ['pending', 'overdue']),
      supabaseAdmin.from('inquiries').select('priority, status').eq('school_id', schoolId).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabaseAdmin.from('recordings').select('coaching_score').eq('school_id', schoolId).eq('status', 'done').gte('uploaded_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabaseAdmin.from('teacher_attendance').select('status').eq('school_id', schoolId).eq('date', today),
      supabaseAdmin.from('events').select('title, event_date').eq('school_id', schoolId).gte('event_date', today).order('event_date').limit(3),
    ]);

    const totalStudents = studentsRes.count ?? 0;
    const attRecords = attendanceRes.data ?? [];
    const presentCount = attRecords.filter(a => a.status === 'present').length;
    const attendancePct = attRecords.length > 0 ? Math.round((presentCount / attRecords.length) * 100) : 0;
    const pendingFees = feesRes.data ?? [];
    const totalFeePending = pendingFees.reduce((s, f) => s + Number(f.amount ?? 0), 0);
    const newLeads = (leadsRes.data ?? []).length;
    const highLeads = (leadsRes.data ?? []).filter(l => l.priority === 'high').length;
    const evalScores = evalsRes.data ?? [];
    const avgEvalScore = evalScores.length ? Math.round(evalScores.reduce((s, e) => s + Number(e.coaching_score ?? 0), 0) / evalScores.length) : 0;
    const teacherPresent = (teacherAttRes.data ?? []).filter(t => t.status === 'present').length;
    const teacherTotal = teacherAttRes.data?.length ?? 0;
    const upcomingEvents = eventsRes.data ?? [];

    const kpiSnapshot = {
      total_students: totalStudents,
      attendance_pct: attendancePct,
      pending_fees_amount: totalFeePending,
      new_leads_week: newLeads,
      high_priority_leads: highLeads,
      avg_eval_score: avgEvalScore || 'N/A',
      teachers_present: teacherTotal > 0 ? `${teacherPresent}/${teacherTotal}` : 'Not marked',
    };

    const briefingText = await callClaude(
      `You are an AI school intelligence system writing a daily briefing for the principal of ${schoolName}.\nWrite professionally but conversationally. Use bullet points with • symbol. Be specific with numbers.\nFlag urgent concerns. Under 280 words. Format: greeting → 5-6 bullets → action items.`,
      `School: ${schoolName} | Date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\nDATA:\n- Total students: ${totalStudents}\n- Attendance today: ${attendancePct}% (${presentCount}/${attRecords.length || 'not recorded'})\n- Teachers present: ${teacherTotal > 0 ? `${teacherPresent}/${teacherTotal}` : 'not marked'}\n- Pending fees: ₹${Math.round(totalFeePending / 1000)}K (${pendingFees.filter(f => f.status === 'overdue').length} overdue)\n- Admissions leads this week: ${newLeads} (${highLeads} high priority)\n- Teaching quality avg: ${avgEvalScore ? `${avgEvalScore}/10` : 'no recent evals'}\n- Upcoming events: ${upcomingEvents.length ? upcomingEvents.map(e => `${e.title} (${e.event_date})`).join(', ') : 'none'}\n\nGenerate the principal daily briefing now.`,
      550
    );

    const { data, error } = await supabaseAdmin
      .from('principal_briefings')
      .upsert({ school_id: schoolId, date: today, briefing_text: briefingText, kpi_snapshot: kpiSnapshot, generated_at: new Date().toISOString() }, { onConflict: 'school_id,date' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, briefing: data });
  } catch (err) {
    console.error('Briefing generate error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const schoolId = getSchoolId(req);
  try {
    const { data, error } = await supabaseAdmin
      .from('principal_briefings').select('*').eq('school_id', schoolId).order('date', { ascending: false }).limit(7);
    if (error) throw new Error(error.message);
    return NextResponse.json({ briefings: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
