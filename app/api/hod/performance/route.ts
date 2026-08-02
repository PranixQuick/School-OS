import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireHodSession, HodAuthError } from '@/lib/hod-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const hod = await requireHodSession(req);
    
    // Fetch departments mapped to this HOD's scope
    const orConditions = hod.scope.map((s: any) => 
      `and(school_id.eq.${s.school_id},name.eq.${s.department})`
    ).join(',');
    
    const { data: depts, error: deptsErr } = await supabaseAdmin
      .from('departments')
      .select('id, name, school_id')
      .or(orConditions);
      
    if (deptsErr) return NextResponse.json({ error: deptsErr.message }, { status: 500 });
    if (!depts || depts.length === 0) return NextResponse.json({ performance: [] });
    
    const deptIds = depts.map(d => d.id);

    // Fetch students in HOD's scope and departments
    const { data: students, error: studentsErr } = await supabaseAdmin
      .from('students')
      .select('id, name, department_id, school_id, batch_id')
      .in('school_id', hod.schoolIds)
      .in('department_id', deptIds);
      
    if (studentsErr) return NextResponse.json({ error: studentsErr.message }, { status: 500 });
    if (!students || students.length === 0) return NextResponse.json({ performance: [] });
    
    const studentIds = students.map(s => s.id);
    
    // Fetch test scores
    const { data: scores } = await supabaseAdmin
      .from('test_scores')
      .select('student_id, score, test:test_id(max_marks)')
      .in('student_id', studentIds);
      
    // Fetch attendance
    const { data: attendance } = await supabaseAdmin
      .from('attendance')
      .select('student_id, status')
      .in('student_id', studentIds);
      
    // Group by student
    const studentMap = new Map(students.map(s => [s.id, s]));
    
    // Calculate aggregate performance per batch in memory
    const batchStats: Record<string, { batch_name: string; total_score: number; max_score: number; present_days: number; total_days: number }> = {};
    
    // Query batch details
    const batchIds = [...new Set(students.map(s => s.batch_id).filter(Boolean))];
    const { data: batches } = await supabaseAdmin
      .from('batches')
      .select('id, label')
      .in('id', batchIds);
    const batchNames = new Map(batches?.map(b => [b.id, b.label]) ?? []);

    for (const s of students) {
      const bid = s.batch_id ?? 'unknown';
      if (!batchStats[bid]) {
        batchStats[bid] = {
          batch_name: batchNames.get(bid) ?? 'General Class',
          total_score: 0,
          max_score: 0,
          present_days: 0,
          total_days: 0
        };
      }
    }
    
    // Aggregate scores
    for (const sc of scores ?? []) {
      const student = studentMap.get(sc.student_id);
      if (!student) continue;
      const bid = student.batch_id ?? 'unknown';
      const stats = batchStats[bid];
      if (stats && sc.test) {
        stats.total_score += sc.score ?? 0;
        stats.max_score += (sc.test as any).max_marks ?? 100;
      }
    }
    
    // Aggregate attendance
    for (const att of attendance ?? []) {
      const student = studentMap.get(att.student_id);
      if (!student) continue;
      const bid = student.batch_id ?? 'unknown';
      const stats = batchStats[bid];
      if (stats) {
        stats.total_days++;
        if (att.status === 'present') {
          stats.present_days++;
        }
      }
    }
    
    const result = Object.entries(batchStats).map(([bid, stats]) => ({
      batch_id: bid === 'unknown' ? null : bid,
      batch_name: stats.batch_name,
      avg_marks_pct: stats.max_score > 0 ? Math.round((stats.total_score / stats.max_score) * 100) : 0,
      avg_attendance_pct: stats.total_days > 0 ? Math.round((stats.present_days / stats.total_days) * 100) : 0
    }));
    
    return NextResponse.json({ performance: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 403 });
}

export async function PATCH() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 403 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 403 });
}
