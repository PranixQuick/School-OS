// app/api/counsellor/dashboard/route.ts
// Counsellor dashboard data: at-risk students (from student_risk_flags),
// open follow-ups and recent notes (from counselling_sessions). READ-ONLY.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';
const ALLOWED = ['counsellor', 'admin', 'owner', 'principal'];

interface StudentLite { id: string; name: string; class: string | null; section: string | null; }
interface FlagRow { id: string; student_id: string; risk_level: string | null; risk_factors: unknown; ai_summary: string | null; attendance_pct: number | null; avg_score: number | null; fee_overdue: boolean | null; }
interface SessionRow { id: string; student_id: string; session_date: string; concern: string | null; action_taken: string | null; follow_up_date: string | null; follow_up_done?: boolean; }

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ALLOWED.includes(session.userRole)) return NextResponse.json({ error: 'Counsellor role required' }, { status: 403 });
  const schoolId = session.schoolId;

  const { data: flagsRaw } = await supabaseAdmin
    .from('student_risk_flags')
    .select('id, student_id, risk_level, risk_factors, ai_summary, attendance_pct, avg_score, fee_overdue, flagged_at')
    .eq('school_id', schoolId)
    .is('resolved_at', null)
    .order('flagged_at', { ascending: false });
  const flags = (flagsRaw as FlagRow[] | null) ?? [];

  const { data: followRaw } = await supabaseAdmin
    .from('counselling_sessions')
    .select('id, student_id, session_date, concern, action_taken, follow_up_date')
    .eq('school_id', schoolId)
    .eq('follow_up_done', false)
    .not('follow_up_date', 'is', null)
    .order('follow_up_date', { ascending: true });
  const follows = (followRaw as SessionRow[] | null) ?? [];

  const { data: recentRaw } = await supabaseAdmin
    .from('counselling_sessions')
    .select('id, student_id, session_date, concern, action_taken, follow_up_date, follow_up_done')
    .eq('school_id', schoolId)
    .order('session_date', { ascending: false })
    .limit(20);
  const recent = (recentRaw as SessionRow[] | null) ?? [];

  const ids = Array.from(new Set([
    ...flags.map(f => f.student_id),
    ...follows.map(f => f.student_id),
    ...recent.map(r => r.student_id),
  ].filter((x): x is string => !!x)));
  const stuMap = new Map<string, StudentLite>();
  if (ids.length) {
    const { data: studs } = await supabaseAdmin.from('students').select('id, name, class, section').in('id', ids);
    for (const s of ((studs as StudentLite[] | null) ?? [])) stuMap.set(s.id, s);
  }
  const nameOf = (id: string) => stuMap.get(id)?.name ?? 'Unknown';
  const classOf = (id: string) => { const s = stuMap.get(id); return s ? `${s.class ?? ''}${s.section ? '-' + s.section : ''}` : ''; };

  return NextResponse.json({
    at_risk: flags.map(f => ({
      id: f.id, student_id: f.student_id, name: nameOf(f.student_id), class: classOf(f.student_id),
      risk_level: f.risk_level, risk_factors: f.risk_factors, ai_summary: f.ai_summary,
      attendance_pct: f.attendance_pct, avg_score: f.avg_score, fee_overdue: f.fee_overdue,
    })),
    follow_ups: follows.map(f => ({
      id: f.id, student_id: f.student_id, name: nameOf(f.student_id), class: classOf(f.student_id),
      session_date: f.session_date, concern: f.concern, action_taken: f.action_taken, follow_up_date: f.follow_up_date,
    })),
    recent_sessions: recent.map(r => ({
      id: r.id, student_id: r.student_id, name: nameOf(r.student_id), class: classOf(r.student_id),
      session_date: r.session_date, concern: r.concern, action_taken: r.action_taken,
      follow_up_date: r.follow_up_date, follow_up_done: r.follow_up_done ?? false,
    })),
    counts: { at_risk: flags.length, follow_ups: follows.length },
  });
}
