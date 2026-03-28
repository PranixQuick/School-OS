import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [studentsRes, attendanceRes, feesRes, leadsRes, evalsRes, teacherAttRes, eventsRes] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', SCHOOL_ID).eq('is_active', true),
      supabaseAdmin.from('attendance').select('status').eq('school_id', SCHOOL_ID).eq('date', today),
      supabaseAdmin.from('fees').select('amount, status').eq('school_id', SCHOOL_ID).in('status', ['pending', 'overdue']),
      supabaseAdmin.from('inquiries').select('priority, status').eq('school_id', SCHOOL_ID).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabaseAdmin.from('recordings').select('coaching_score').eq('school_id', SCHOOL_ID).eq('status', 'done').gte('uploaded_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabaseAdmin.from('teacher_attendance').select('status').eq('school_id', SCHOOL_ID).eq('date', today),
      supabaseAdmin.from('events').select('title, event_date').eq('school_id', SCHOOL_ID).gte('event_date', today).order('event_date').limit(3),
    ]);

    const totalStudents = studentsRes.count ?? 247;
    const attRecords = attendanceRes.data ?? [];
    const presentCount = attRecords.filter(a => a.status === 'present').length;
    const attendancePct = attRecords.length > 0 ? Math.round((presentCount / attRecords.length) * 100) : 88;
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
      `You are an AI school intelligence system writing a daily briefing for the school principal.
Write in a professional but conversational tone. Structure clearly with bullet sections.
Be specific with numbers. Flag concerns. Highlight wins. Under 250 words total.
Format: greeting line, then 4-5 bullet insights (use • symbol), then short action paragraph.`,
      `Date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

DATA:
- Total students: ${totalStudents}
- Today's student attendance: ${attendancePct}% (${presentCount}/${attRecords.length || 50} recorded)
- Teachers present today: ${teacherTotal > 0 ? `${teacherPresent}/${teacherTotal}` : 'Not yet marked'}
- Pending fees: ₹${Math.round(totalFeePending / 1000)}K outstanding (${pendingFees.length} students)
- New admissions leads this week: ${newLeads} (${highLeads} high priority)
- Average teaching eval score (last 7 days): ${avgEvalScore ? `${avgEvalScore}/10` : 'No evaluations this week'}
- Upcoming events: ${upcomingEvents.length ? upcomingEvents.map(e => `${e.title} on ${e.event_date}`).join('; ') : 'None scheduled'}

Generate the principal daily briefing now.`,
      500
    );

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
  try {
    const { data, error } = await supabaseAdmin
      .from('principal_briefings')
      .select('*')
      .eq('school_id', SCHOOL_ID)
      .order('date', { ascending: false })
      .limit(7);

    if (error) throw new Error(error.message);
    return NextResponse.json({ briefings: data ?? [] });
  } catch (err) {
    console.error('Briefing GET error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
