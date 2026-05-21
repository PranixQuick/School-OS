// app/api/admin/promotion/route.ts
// Year-end student promotion. Updates all active students to their next class.
// Handles: promotions (KG→1, 1→2…9→10), graduations (final year), retentions (manual).
// Creates promotion_log entry for audit trail.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

const CLASS_SEQUENCE: Record<string, string> = {
  'KG': '1', '1': '2', '2': '3', '3': '4', '4': '5',
  '5': '6', '6': '7', '7': '8', '8': '9', '9': '10',
};
const FINAL_CLASSES = ['10', '12', 'III Year', 'IV Year', 'Final Year'];

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner','principal'].includes(session.userRole)) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const [studentsRes, logsRes] = await Promise.allSettled([
    supabaseAdmin.from('students').select('class, section').eq('school_id', session.schoolId).eq('is_active', true).order('class').order('section'),
    supabaseAdmin.from('promotion_logs').select('id, promoted_at, total_students, promoted_count, retained_count, graduated_count, status').eq('school_id', session.schoolId).order('promoted_at', { ascending: false }).limit(5),
  ]);

  const students = studentsRes.status === 'fulfilled' ? (studentsRes.value.data ?? []) : [];
  const logs     = logsRes.status === 'fulfilled' ? (logsRes.value.data ?? []) : [];

  // Aggregate class groups
  const groupMap: Record<string, number> = {};
  for (const s of students) {
    const key = `${s.class}|||${s.section ?? 'A'}`;
    groupMap[key] = (groupMap[key] ?? 0) + 1;
  }
  const class_groups = Object.entries(groupMap).map(([key, count]) => {
    const [cls, section] = key.split('|||');
    return { class: cls, section, count };
  }).sort((a, b) => {
    const numA = parseInt(a.class) || 0;
    const numB = parseInt(b.class) || 0;
    return numA - numB;
  });

  return NextResponse.json({ class_groups, logs });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner','principal'].includes(session.userRole)) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const sid = session.schoolId;

  // Get all active students
  const { data: students, error: sErr } = await supabaseAdmin
    .from('students').select('id, class').eq('school_id', sid).eq('is_active', true);
  if (sErr || !students) return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });

  let promoted = 0, retained = 0, graduated = 0;

  for (const student of students) {
    const cls = student.class;
    if (FINAL_CLASSES.includes(cls)) {
      // Graduate — deactivate
      await supabaseAdmin.from('students').update({ is_active: false }).eq('id', student.id);
      graduated++;
    } else {
      const nextClass = CLASS_SEQUENCE[cls];
      if (nextClass) {
        await supabaseAdmin.from('students').update({ class: nextClass }).eq('id', student.id);
        promoted++;
      } else {
        retained++;
      }
    }
  }

  // Create promotion log
  await supabaseAdmin.from('promotion_logs').insert({
    school_id:       sid,
    promoted_by:     session.userId,
    promoted_at:     new Date().toISOString(),
    total_students:  students.length,
    promoted_count:  promoted,
    retained_count:  retained,
    graduated_count: graduated,
    status:          'completed',
  });

  return NextResponse.json({ success: true, promoted, retained, graduated, total: students.length });
}
