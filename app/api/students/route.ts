import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';
import { logActivity } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const classFilter = req.nextUrl.searchParams.get('class');
    const section = req.nextUrl.searchParams.get('section');
    const search = req.nextUrl.searchParams.get('search');
    const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true';

    let query = supabaseAdmin
      .from('students')
      .select('id, name, class, section, roll_number, admission_number, phone_parent, parent_name, date_of_birth, is_active, created_at')
      .eq('school_id', schoolId)
      .order('class', { ascending: true })
      .order('name', { ascending: true });

    if (!includeInactive) query = query.eq('is_active', true);
    if (classFilter) query = query.eq('class', classFilter);
    if (section) query = query.eq('section', section);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ students: data ?? [], total: count ?? data?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const body = await req.json() as {
      name: string; class: string; section?: string;
      roll_number?: string; admission_number?: string;
      phone_parent?: string; parent_name?: string; date_of_birth?: string;
    };

    if (!body.name || !body.class) {
      return NextResponse.json({ error: 'name and class are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('students')
      .insert({
        school_id: schoolId,
        name: body.name,
        class: body.class,
        section: body.section ?? 'A',
        roll_number: body.roll_number ?? null,
        admission_number: body.admission_number ?? null,
        phone_parent: body.phone_parent ?? null,
        parent_name: body.parent_name ?? null,
        date_of_birth: body.date_of_birth ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logActivity({
      schoolId,
      action: `Added student: ${body.name} (Class ${body.class})`,
      module: 'import',
      details: { name: body.name, class: body.class },
    });

    return NextResponse.json({ success: true, student: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const body = await req.json() as {
      id: string; name?: string; class?: string; section?: string;
      roll_number?: string; admission_number?: string;
      phone_parent?: string; parent_name?: string; date_of_birth?: string;
      is_active?: boolean;
    };

    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('students')
      .update({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.class !== undefined && { class: body.class }),
        ...(body.section !== undefined && { section: body.section }),
        ...(body.roll_number !== undefined && { roll_number: body.roll_number }),
        ...(body.admission_number !== undefined && { admission_number: body.admission_number }),
        ...(body.phone_parent !== undefined && { phone_parent: body.phone_parent }),
        ...(body.parent_name !== undefined && { parent_name: body.parent_name }),
        ...(body.date_of_birth !== undefined && { date_of_birth: body.date_of_birth }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      })
      .eq('id', body.id)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, student: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Soft delete via is_active
    const { error } = await supabaseAdmin
      .from('students')
      .update({ is_active: false })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw new Error(error.message);

    await logActivity({
      schoolId,
      action: `Deactivated student (soft delete)`,
      module: 'import',
      details: { student_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
