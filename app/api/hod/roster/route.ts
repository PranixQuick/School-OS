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
    if (!depts || depts.length === 0) return NextResponse.json({ roster: [] });
    
    const deptIds = depts.map(d => d.id);

    // Fetch timetable entries
    const { data: entries, error } = await supabaseAdmin
      .from('timetable')
      .select(`
        id, class_id, subject_id, staff_id, day_of_week, period, start_time, end_time,
        classes:class_id ( grade_level, section ),
        subjects:subject_id ( name ),
        staff:staff_id ( name, department_id )
      `)
      .in('school_id', hod.schoolIds);
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Filter in-memory for entries where teacher belongs to HOD's departments
    const filteredEntries = entries?.filter((e: any) => 
      e.staff && deptIds.includes(e.staff.department_id)
    ) ?? [];
    
    return NextResponse.json({ roster: filteredEntries });
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
