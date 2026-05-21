// app/api/admin/night-attendance/students/route.ts
// Returns students who are in hostel (active hostel allocations)
// Used by night attendance page to know who to mark
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Get students with active hostel allocations
  const { data: allocs } = await supabaseAdmin
    .from('hostel_allocations')
    .select('student_id, room:room_id(room_number, block)')
    .eq('school_id', session.schoolId)
    .eq('status', 'active')
    .limit(500);
  if (!allocs?.length) {
    // Fallback: if no hostel allocs, return all active students
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, name, class, section')
      .eq('school_id', session.schoolId)
      .eq('is_active', true)
      .order('class').order('name')
      .limit(500);
    return NextResponse.json({ students: (students ?? []).map(s => ({ id: s.id, name: s.name, class: `${s.class}-${s.section}` })) });
  }
  const studentIds = allocs.map(a => a.student_id);
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, class, section')
    .in('id', studentIds)
    .eq('is_active', true)
    .order('name');
  const roomMap = Object.fromEntries(allocs.map(a => [a.student_id, (a.room as { room_number?: string } | null)?.room_number ?? '']));
  return NextResponse.json({ students: (students ?? []).map(s => ({ id: s.id, name: s.name, class: `${s.class}-${s.section}`, room: roomMap[s.id] })) });
}
