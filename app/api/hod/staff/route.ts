import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireHodSession, HodAuthError } from '@/lib/hod-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const hod = await requireHodSession(req);
    
    // First, fetch the departments mapped to this HOD's scope
    const orConditions = hod.scope.map((s: any) => 
      `and(school_id.eq.${s.school_id},name.eq.${s.department})`
    ).join(',');
    
    const { data: depts, error: deptsErr } = await supabaseAdmin
      .from('departments')
      .select('id, name, school_id')
      .or(orConditions);
      
    if (deptsErr) return NextResponse.json({ error: deptsErr.message }, { status: 500 });
    if (!depts || depts.length === 0) return NextResponse.json({ staff: [], count: 0 });
    
    const deptIds = depts.map(d => d.id);
    const deptMap = new Map(depts.map(d => [d.id, d.name]));
    
    // Query teachers with matched department_id and school_id
    const { data: staff, error } = await supabaseAdmin
      .from('staff')
      .select('id, name, email, role, department_id, school_id')
      .eq('role', 'teacher')
      .eq('is_active', true)
      .in('department_id', deptIds)
      .in('school_id', hod.schoolIds);
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    const result = staff?.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      department_id: s.department_id,
      department: deptMap.get(s.department_id) ?? '',
      school_id: s.school_id
    })) ?? [];
    
    return NextResponse.json({ staff: result, count: result.length });
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
