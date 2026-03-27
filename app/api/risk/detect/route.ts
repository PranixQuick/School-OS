import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

interface StudentRisk {
  studentId: string;
  name: string;
  class: string;
  attendancePct: number;
  avgScore: number;
  feeOverdue: boolean;
  riskFactors: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export async function POST(_req: NextRequest) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [studentsRes, attendanceRes, academicRes, feesRes] = await Promise.all([
      supabaseAdmin.from('students').select('id, name, class, section').eq('school_id', SCHOOL_ID).eq('is_active', true),
      supabaseAdmin.from('attendance').select('student_id, status').eq('school_id', SCHOOL_ID).gte('date', thirtyDaysAgo),
      supabaseAdmin.from('academic_records').select('student_id, marks_obtained, max_marks').eq('school_id', SCHOOL_ID),
      supabaseAdmin.from('fees').select('student_id, status').eq('school_id', SCHOOL_ID).in('status', ['overdue']),
    ]);

    const students = studentsRes.data ?? [];
    const attendance = attendanceRes.data ?? [];
    const academics = academicRes.data ?? [];
    const overdues = new Set((feesRes.data ?? []).map(f => f.student_id));

    const risks: StudentRisk[] = [];

    for (const student of students) {
      const studentAtt = attendance.filter(a => a.student_id === student.id);
      const presentCount = studentAtt.filter(a => a.status === 'present').length;
      const attendancePct = studentAtt.length > 0 ? Math.round((presentCount / studentAtt.length) * 100) : 100;

      const studentAcad = academics.filter(a => a.student_id === student.id);
      const avgScore = studentAcad.length > 0
        ? Math.round(studentAcad.reduce((s, r) => s + (Number(r.marks_obtained) / Number(r.max_marks || 1)) * 100, 0) / studentAcad.length)
        : 100;

      const feeOverdue = overdues.has(student.id);
      const riskFactors: string[] = [];

      if (attendancePct < 75) riskFactors.push(`Low attendance: ${attendancePct}%`);
      if (avgScore < 50) riskFactors.push(`Low avg score: ${avgScore}%`);
      if (feeOverdue) riskFactors.push('Fee overdue');

      let riskLevel: StudentRisk['riskLevel'] = 'low';
      if (riskFactors.length >= 3) riskLevel = 'critical';
      else if (riskFactors.length === 2) riskLevel = 'high';
      else if (riskFactors.length === 1) riskLevel = 'medium';

      if (riskFactors.length > 0) {
        risks.push({ studentId: student.id, name: student.name, class: student.class, attendancePct, avgScore, feeOverdue, riskFactors, riskLevel });
      }
    }

    // Generate AI summaries for high/critical risk students
    const flagsToUpsert = await Promise.all(
      risks.map(async (risk) => {
        let aiSummary = '';
        if (risk.riskLevel === 'high' || risk.riskLevel === 'critical') {
          try {
            aiSummary = await callClaude(
              `You are a school counsellor. Write a 1-sentence action recommendation for this at-risk student. Be specific and actionable.`,
              `Student: ${risk.name}, Class ${risk.class}. Issues: ${risk.riskFactors.join(', ')}. Attendance: ${risk.attendancePct}%, Avg score: ${risk.avgScore}%.`,
              100
            );
          } catch { aiSummary = `Immediate intervention needed: ${risk.riskFactors.join(', ')}.`; }
        }

        return {
          school_id: SCHOOL_ID,
          student_id: risk.studentId,
          risk_level: risk.riskLevel,
          risk_factors: risk.riskFactors,
          ai_summary: aiSummary,
          attendance_pct: risk.attendancePct,
          avg_score: risk.avgScore,
          fee_overdue: risk.feeOverdue,
          flagged_at: new Date().toISOString(),
          resolved_at: null,
        };
      })
    );

    if (flagsToUpsert.length > 0) {
      await supabaseAdmin.from('student_risk_flags')
        .upsert(flagsToUpsert, { onConflict: 'school_id,student_id' });
    }

    return NextResponse.json({
      success: true,
      total_scanned: students.length,
      at_risk: risks.length,
      breakdown: {
        critical: risks.filter(r => r.riskLevel === 'critical').length,
        high: risks.filter(r => r.riskLevel === 'high').length,
        medium: risks.filter(r => r.riskLevel === 'medium').length,
      },
      students: risks,
    });
  } catch (err) {
    console.error('Risk detection error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('student_risk_flags')
    .select('*, students(name, class, section)')
    .eq('school_id', SCHOOL_ID)
    .is('resolved_at', null)
    .order('risk_level', { ascending: true })
    .order('flagged_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flags: data ?? [] });
}
