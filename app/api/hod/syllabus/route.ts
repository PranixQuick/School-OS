import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireHodSession, HodAuthError } from '@/lib/hod-auth';

export const runtime = 'nodejs';

const ALLOWED_STATUS = new Set(['planned', 'in_progress', 'completed']);

// Resolve the department ids in this HOD's scope (school_id + department name pairs).
async function resolveDeptIds(hod: any): Promise<string[]> {
  const orConditions = hod.scope
    .map((s: any) => `and(school_id.eq.${s.school_id},name.eq.${s.department})`)
    .join(',');
  const { data: depts } = await supabaseAdmin
    .from('departments')
    .select('id, name, school_id')
    .or(orConditions);
  return (depts ?? []).map((d: any) => d.id);
}

export async function GET(req: NextRequest) {
  try {
    const hod = await requireHodSession(req);
    const deptIds = await resolveDeptIds(hod);
    if (deptIds.length === 0) return NextResponse.json({ syllabus: [] });

    const { data: plans, error } = await supabaseAdmin
      .from('yearly_syllabus_plan')
      .select(`
        id, school_id, subject_id, class_id, staff_id, week_number, topic_name, chapter_ref, status,
        classes:class_id ( grade_level, section ),
        subjects:subject_id ( name ),
        staff:staff_id ( name, department_id )
      `)
      .in('school_id', hod.schoolIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const filteredPlans = (plans ?? []).filter((p: any) => p.staff && deptIds.includes(p.staff.department_id));
    return NextResponse.json({ syllabus: filteredPlans });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// HOD assigns a portion topic to a teacher for a campus/subject/class/week.
export async function POST(req: NextRequest) {
  try {
    const hod = await requireHodSession(req);
    const body = await req.json().catch(() => ({}));
    const { staff_id, subject_id, class_id, week_number, topic_name, chapter_ref } = body as Record<string, any>;

    if (!staff_id || !subject_id || !class_id || !topic_name || week_number == null) {
      return NextResponse.json({ error: 'staff_id, subject_id, class_id, week_number and topic_name are required.' }, { status: 400 });
    }

    // Campus is derived from the assigned teacher; validate that teacher is in scope.
    const deptIds = await resolveDeptIds(hod);
    const { data: staffRow } = await supabaseAdmin
      .from('staff')
      .select('id, department_id, school_id')
      .eq('id', staff_id)
      .maybeSingle();
    if (!staffRow || !deptIds.includes(staffRow.department_id) || !hod.schoolIds.includes(staffRow.school_id)) {
      return NextResponse.json({ error: 'That staff member is not in your department scope.' }, { status: 403 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('yearly_syllabus_plan')
      .insert({
        school_id: staffRow.school_id,
        staff_id,
        subject_id,
        class_id,
        week_number: Number(week_number),
        topic_name: String(topic_name).slice(0, 300),
        chapter_ref: chapter_ref ? String(chapter_ref).slice(0, 120) : null,
        status: 'planned',
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: inserted?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// HOD (or the assigned teacher) updates the coverage status of a portion topic.
export async function PATCH(req: NextRequest) {
  try {
    const hod = await requireHodSession(req);
    const body = await req.json().catch(() => ({}));
    const { id, status } = body as Record<string, any>;

    if (!id || !status || !ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ error: 'id and a valid status (planned | in_progress | completed) are required.' }, { status: 400 });
    }

    // Confirm the row is inside the HOD's scope before updating.
    const { data: row } = await supabaseAdmin
      .from('yearly_syllabus_plan')
      .select('id, school_id, staff:staff_id ( department_id )')
      .eq('id', id)
      .maybeSingle();

    const deptIds = await resolveDeptIds(hod);
    const staffDept = (row as any)?.staff?.department_id;
    if (!row || !hod.schoolIds.includes((row as any).school_id) || !deptIds.includes(staffDept)) {
      return NextResponse.json({ error: 'That topic is not in your scope.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('yearly_syllabus_plan')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 403 });
}
