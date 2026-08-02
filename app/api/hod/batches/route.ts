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
    if (!depts || depts.length === 0) return NextResponse.json({ batches: [] });
    
    const deptIds = depts.map(d => d.id);
    
    // Fetch batches in these departments
    const { data: batchesData, error: batchesErr } = await supabaseAdmin
      .from('batches')
      .select('id, label, entry_year, department_id, capacity')
      .in('department_id', deptIds);
      
    if (batchesErr) return NextResponse.json({ error: batchesErr.message }, { status: 500 });
    
    const batches = batchesData ?? [];
    const counts: Record<string, number> = {};
    if (batches.length) {
      const ids = batches.map(b => b.id);
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('batch_id')
        .in('batch_id', ids)
        .eq('is_active', true);
      for (const s of students ?? []) {
        if (s.batch_id) counts[s.batch_id] = (counts[s.batch_id] ?? 0) + 1;
      }
    }
    
    const result = batches.map(b => ({
      id: b.id,
      label: b.label,
      entry_year: b.entry_year,
      department_id: b.department_id,
      student_count: counts[b.id] ?? 0
    }));
    
    return NextResponse.json({ batches: result });
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
