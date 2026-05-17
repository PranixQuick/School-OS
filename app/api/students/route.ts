// app/api/students/route.ts
// Full student lifecycle: GET list, POST create, PATCH edit/transfer/graduate/archive, DELETE soft-deactivate
// Real workflow: class teacher or admin edits student register daily
// Lifecycle transitions: active → transferred | graduated | withdrawn | archived
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';
import { logActivity } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const classFilter = req.nextUrl.searchParams.get('class');
    const section = req.nextUrl.searchParams.get('section');
    const status = req.nextUrl.searchParams.get('status') ?? 'active';
    const search = req.nextUrl.searchParams.get('q');
    const batchId = req.nextUrl.searchParams.get('batch_id');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '200', 10) || 200, 1000);

    let q = supabaseAdmin
      .from('students')
      .select('id, name, class, section, roll_number, admission_number, phone_parent, parent_name, date_of_birth, is_active, status, batch_id, institution_id, stream_group, created_at, transfer_school, transfer_date, graduation_year')
      .eq('school_id', schoolId)
      .order('name', { ascending: true })
      .limit(limit);

    if (status === 'all') {
      // no filter
    } else {
      q = q.eq('status', status);
    }
    if (classFilter) q = q.eq('class', classFilter);
    if (section) q = q.eq('section', section);
    if (batchId) q = q.eq('batch_id', batchId);
    if (search) q = q.ilike('name', `%${search}%`);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ students: data ?? [], count: (data ?? []).length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const actorEmail = req.headers.get('x-user-email') ?? 'system';
    const body = await req.json() as Record<string, unknown>;

    const { name, class: cls, section, roll_number, admission_number,
      phone_parent, parent_name, date_of_birth, batch_id, stream_group } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { data: school } = await supabaseAdmin
      .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

    const { data, error } = await supabaseAdmin
      .from('students')
      .insert({
        school_id: schoolId,
        institution_id: school?.institution_id ?? null,
        name: String(name).trim(),
        class: cls ? String(cls).trim() : null,
        section: section ? String(section).trim().toUpperCase() : null,
        roll_number: roll_number ? String(roll_number).trim() : null,
        admission_number: admission_number ? String(admission_number).trim() : null,
        phone_parent: phone_parent ? String(phone_parent).trim() : null,
        parent_name: parent_name ? String(parent_name).trim() : null,
        date_of_birth: date_of_birth ? String(date_of_birth) : null,
        batch_id: batch_id ? String(batch_id) : null,
        stream_group: stream_group ? String(stream_group).trim() : null,
        status: 'active',
        is_active: true,
      })
      .select('id, name, class, section, admission_number, status')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({ schoolId, action: 'student_created', module: 'students',
      actorEmail, details: { student_id: data.id, name: data.name } });

    return NextResponse.json({ success: true, student: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const actorEmail = req.headers.get('x-user-email') ?? 'system';
    const body = await req.json() as Record<string, unknown>;
    const { id, action: lifecycleAction, ...fields } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // Fetch current student to validate school ownership
    const { data: existing } = await supabaseAdmin
      .from('students').select('id, name, status, school_id').eq('id', id).maybeSingle();
    if (!existing || existing.school_id !== schoolId) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    let update: Record<string, unknown> = {};
    let auditAction = 'student_updated';

    // Lifecycle transitions — real India school workflow
    if (lifecycleAction === 'transfer') {
      // Student moves to another school — TC issued separately
      update = {
        status: 'transferred',
        is_active: false,
        transfer_school: fields.transfer_school ? String(fields.transfer_school).trim() : null,
        transfer_date: fields.transfer_date ? String(fields.transfer_date) : new Date().toISOString().split('T')[0],
      };
      auditAction = 'student_transferred';
    } else if (lifecycleAction === 'graduate') {
      // End of academic journey — passout
      update = {
        status: 'graduated',
        is_active: false,
        graduation_year: fields.graduation_year ? Number(fields.graduation_year) : new Date().getFullYear(),
      };
      auditAction = 'student_graduated';
    } else if (lifecycleAction === 'withdraw') {
      // Left school without formal TC
      update = { status: 'withdrawn', is_active: false };
      auditAction = 'student_withdrawn';
    } else if (lifecycleAction === 'archive') {
      // Administrative archive — old inactive record
      update = { status: 'archived', is_active: false };
      auditAction = 'student_archived';
    } else if (lifecycleAction === 'reactivate') {
      // Undo accidental deactivation (only if transferred/withdrawn, not graduated)
      if (existing.status === 'graduated') {
        return NextResponse.json({ error: 'Graduated students cannot be reactivated' }, { status: 400 });
      }
      update = { status: 'active', is_active: true, transfer_school: null, transfer_date: null };
      auditAction = 'student_reactivated';
    } else {
      // Regular field edit
      const editable = ['name', 'class', 'section', 'roll_number', 'admission_number',
        'phone_parent', 'parent_name', 'date_of_birth', 'batch_id', 'stream_group',
        'blood_group', 'emergency_contact_name', 'emergency_contact_phone'];
      for (const k of editable) {
        if (k in fields) {
          update[k] = fields[k] === '' ? null : fields[k];
        }
      }
      if (!Object.keys(update).length) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('students').update(update).eq('id', id).eq('school_id', schoolId)
      .select('id, name, status, class, section, is_active').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Write lifecycle event for audit trail
    await supabaseAdmin.from('student_lifecycle_events').insert({
      student_id: id,
      school_id: schoolId,
      from_status: existing.status,
      to_status: data.status,
      triggered_by: actorEmail,
      notes: fields.notes ? String(fields.notes) : null,
      metadata: { action: lifecycleAction ?? 'edit', fields_updated: Object.keys(update) },
    });

    await logActivity({ schoolId, action: auditAction, module: 'students',
      actorEmail, details: { student_id: id, name: data.name, update } });

    return NextResponse.json({ success: true, student: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const actorEmail = req.headers.get('x-user-email') ?? 'system';
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Soft delete — never hard delete student records
    const { data, error } = await supabaseAdmin
      .from('students')
      .update({ is_active: false, status: 'archived' })
      .eq('id', id).eq('school_id', schoolId)
      .select('id, name').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({ schoolId, action: 'student_deactivated', module: 'students',
      actorEmail, details: { student_id: id, name: data.name } });

    return NextResponse.json({ success: true, message: 'Student archived' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
