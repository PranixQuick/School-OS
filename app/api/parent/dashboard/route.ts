import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { schoolId, studentId } = session;

  const [studentRes, attRes, feeRes, noticesRes, schoolRes] = await Promise.allSettled([
    supabaseAdmin.from('students')
      .select('name,class,section,roll_number,admission_number')
      .eq('id', studentId).single(),
    supabaseAdmin.from('attendance')
      .select('status')
      .eq('school_id', schoolId).eq('student_id', studentId)
      .gte('date', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]),
    supabaseAdmin.from('fees')
      .select('amount,status')
      .eq('school_id', schoolId).eq('student_id', studentId)
      .in('status', ['pending', 'overdue']),
    supabaseAdmin.from('broadcasts')
      .select('id,subject,message,created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('schools').select('name').eq('id', schoolId).single(),
  ]);

  const student = studentRes.status === 'fulfilled' ? studentRes.value.data : null;
  const attRows = attRes.status === 'fulfilled' ? (attRes.value.data ?? []) : [];
  const feeRows = feeRes.status === 'fulfilled' ? (feeRes.value.data ?? []) : [];
  const notices = noticesRes.status === 'fulfilled' ? (noticesRes.value.data ?? []) : [];
  const school = schoolRes.status === 'fulfilled' ? schoolRes.value.data : null;

  const total = attRows.length;
  const present = attRows.filter((r: { status: string }) => r.status === 'present').length;
  const pendingAmt = feeRows.reduce((s: number, r: { amount: number }) => s + (r.amount ?? 0), 0);
  const overdue = feeRows.some((r: { status: string }) => r.status === 'overdue');

  return NextResponse.json({
    student,
    school_name: school?.name ?? '',
    attendance: total > 0 ? { present_pct: Math.round((present / total) * 100), total_days: total, present_days: present } : null,
    fee: { pending_amount: pendingAmt, overdue },
    notices,
  });
}
