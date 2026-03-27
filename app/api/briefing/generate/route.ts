import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Gather all data in parallel
    const [studentsRes, attendanceRes, feesRes, leadsRes, evalsRes, teacherAttRes, eventsRes] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', SCHOOL_ID).eq('is_active', true),
      supabaseAdmin.from('attendance').select('status').eq('school_id', SCHOOL_ID).eq('date', today),
      supabaseAdmin.from('fees').select('amount, status').eq('school_id', SCHOOL_ID).in('status', ['pending', 'overdue']),
      supabaseAdmin.from('inquiries').select('priority, status').eq('school_id', SCHOOL_ID).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabaseAdmin.from('recordings').select('coaching_score').eq('school_id', SCHOOL_ID).eq('status', 'done').gte('uploaded_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabaseAdmin.from('teacher_attendance').select('status').eq('school_id', SCHOOL_ID).eq('date', today),
      supabaseAdmin.from('events').select('title, event_date').eq('school_id', SCHOOL_ID).gte('event_date', today).order('event_date').limit(3),
    ]);

    const totalStudents = studentsRes.count ?? 0;
    const attRecords = attendanceRes.data ?? [];
    const presentCount = attRecords.filter(a => a.status === 'present').length;
    const attendancePct = attRecords.length > 0 ? Math.round((presentCount / attRecords.length) * 100) : 0;
    const pendingFees = feesRes.data ?? [];
    const totalFeePending = pendingFees.reduce((s, f) => s + Number(f.amount ?? 0), 0);
    const newLeads = (leadsRes.data ?? []).length;
    const highLeads = (leadsRes.data ?? []).filter(l => l.priority === 'high').length;
    const avgEvalScore = evalsRes.data?.length ? Math.round(evalsRes.data.reduce((s, e) => s + Number(e.coaching_score ?? 0), 0) / evalsRes.data.length) : 0;
    const teacherPresent = (teacherAttRes.data ?? []).filter(t => t.status === 'present').length;
    const teacherTotal = teacherAttRes.data?.length ?? 0;
    const upcomingEvents = eventsRes.data ?? [];

    const kpiSnapshot = {
      total_students: totalStudents,
      attendance_pct: attendancePct,
      pending_fees_amount: totalFeePending,
      new_leads_week: newLeads,
      high_priority_leads: highLeads,
      avg_eval_score: avgEvalScore,
      teachers_present: `${teacherPresent}/${teacherTotal}`,
    };

    const briefingText = await callClaude(
      `You are an AI school intelligence system writing a daily briefing for the school principal.
Write in a professional but conversational tone. Structure clearly with sections.
Be specific with numbers. Flag concerns. Highlight wins. Under 250 words total.
Format: start with a greeting, then 4-5 bullet-point insights, then a short action item paragraph.`,
      `Date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

DATA:
- Total students: ${totalStudents}
- Today's student attendance: ${attendancePct}% (${presentCount}/${attRecords.length} recorded)
- Teachers present today: ${teacherPresent}/${teacherTotal}
- Pending fees: ₹${(totalFeePending / 1000).toFixed(0)}K outstanding (${pendingFees.length} students)
- New admissions leads this week: ${newLeads} (${highLeads} high priority)
- Average teaching quality score (last 7 days): ${avgEvalScore || 'No evaluations'}/10
- Upcoming events: ${upcomingEvents.map(e => `${e.title} on ${e.event_date}`).join('; ') || 'None'}

Generate the principal's daily briefing now.`,
      500
    );

    // Upsert (one briefing per day)
    const { data, error } = await supabaseAdmin
      .from('principal_briefings')
      .upsert({
        school_id: SCHOOL_ID,
        date: today,
        briefing_text: briefingText,
        kpi_snapshot: kpiSnapshot,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'school_id,date' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, briefing: data });
  } catch (err) {
    console.error('Briefing generate error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('principal_briefings')
    .select('*')
    .eq('school_id', SCHOOL_ID)
    .order('date', { ascending: false })
    .limit(7);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ briefings: data ?? [] });
}
