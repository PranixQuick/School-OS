import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { getSchoolId } from '@/lib/getSchoolId';

const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req) || DEMO_SCHOOL_ID;
    const includeResolved = req.nextUrl.searchParams.get('include_resolved') === 'true';

    let query = supabaseAdmin
      .from('student_risk_flags')
      .select('*, students(name, class, section)')
      .eq('school_id', schoolId)
      .order('risk_level', { ascending: false })
      .order('flagged_at', { ascending: false });

    if (!includeResolved) query = query.is('resolved_at', null);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ flags: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req) || DEMO_SCHOOL_ID;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [studentsRes, attendanceRes, academicRes, feesRes] = await Promise.all([
      supabaseAdmin.from('students').select('id, name, class, section').eq('school_id', schoolId).eq('is_active', true),
      supabaseAdmin.from('attendance').select('student_id, status').eq('school_id', schoolId).gte('date', thirtyDaysAgo),
      supabaseAdmin.from('academic_records').select('student_id, marks_obtained, max_marks').eq('school_id', schoolId),
      supabaseAdmin.from('fees').select('student_id, status').eq('school_id', schoolId).in('status', ['overdue']),
    ]);

    const students = studentsRes.data ?? [];
    const attendance = attendanceRes.data ?? [];
    const academics = academicRes.data ?? [];
    const overdues = new Set((feesRes.data ?? []).map(f => f.student_id));

    const flagsToUpsert: Record<string, unknown>[] = [];

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

      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (riskFactors.length >= 3) riskLevel = 'critical';
      else if (riskFactors.length === 2) riskLevel = 'high';
      else if (riskFactors.length === 1) riskLevel = 'medium';

      if (riskFactors.length > 0) {
        let aiSummary = `Requires attention: ${riskFactors.join(', ')}.`;
        if (riskLevel === 'high' || riskLevel === 'critical') {
          try {
            aiSummary = await callClaude(
              `You are a school counsellor. Write a 1-sentence action recommendation for this at-risk student. Be specific and actionable.`,
              `Student: ${student.name}, Class ${student.class}. Issues: ${riskFactors.join(', ')}. Attendance: ${attendancePct}%, Avg score: ${avgScore}%.`,
              100
            );
          } catch { /* keep default */ }
        }

        flagsToUpsert.push({
          school_id: schoolId,
          student_id: student.id,
          risk_level: riskLevel,
          risk_factors: riskFactors,
          ai_summary: aiSummary,
          attendance_pct: attendancePct,
          avg_score: avgScore,
          fee_overdue: feeOverdue,
          flagged_at: new Date().toISOString(),
          resolved_at: null,
        });
      }
    }

    if (flagsToUpsert.length > 0) {
      await supabaseAdmin.from('student_risk_flags')
        .upsert(flagsToUpsert, { onConflict: 'school_id,student_id' });
    }

    return NextResponse.json({
      success: true,
      total_scanned: students.length,
      at_risk: flagsToUpsert.length,
      breakdown: {
        critical: flagsToUpsert.filter(r => r.risk_level === 'critical').length,
        high: flagsToUpsert.filter(r => r.risk_level === 'high').length,
        medium: flagsToUpsert.filter(r => r.risk_level === 'medium').length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH: resolve a risk flag
export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req) || DEMO_SCHOOL_ID;
    const { id, action, resolved_by } = await req.json() as {
      id: string; action: 'resolve' | 'reopen'; resolved_by?: string;
    };

    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('student_risk_flags')
      .update({
        resolved_at: action === 'resolve' ? new Date().toISOString() : null,
        resolved_by: action === 'resolve' ? (resolved_by ?? 'admin') : null,
      })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, flag: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
