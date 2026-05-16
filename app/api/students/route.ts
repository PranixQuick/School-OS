import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient'; // TODO(item-15): migrate to supabaseForUser
import { supabaseForUser as _supabaseForUser } from '@/lib/supabaseForUser'; // I3: factory registered
import { getSchoolId } from '@/lib/getSchoolId';
import { getInstitutionForSchool } from '@/lib/tenant-lookup';
import { logActivity } from '@/lib/logger';
import { sendWhatsApp, normalisePhone } from '@/lib/whatsapp';

function generatePin(): string {
  // 6-digit numeric PIN
  return String(Math.floor(100000 + Math.random() * 900000));
}

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

    // Phase 1 Task 1.4 — dual-write institution_id + academic_year_id alongside school_id.
    const instCtx = await getInstitutionForSchool(schoolId);

    const { data: student, error } = await supabaseAdmin
      .from('students')
      .insert({
        school_id: schoolId,
        institution_id: instCtx.institution_id,
        academic_year_id: instCtx.academic_year_id,
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

    // Auto-generate parent PIN and create parent record
    let pin: string | null = null;
    if (body.phone_parent) {
      pin = generatePin();
      await supabaseAdmin.from('parents').upsert({
        school_id: schoolId,
        student_id: student.id,
        name: body.parent_name ?? 'Parent',
        phone: normalisePhone(body.phone_parent) ?? body.phone_parent,
        access_pin: pin,
        whatsapp_opted_out: false,
      }, { onConflict: 'school_id,student_id' }).then(null, (e: unknown) => {
        console.error('Parent record error:', e);
      });

      // Send PIN via WhatsApp (non-blocking)
      const normPhone = normalisePhone(body.phone_parent);
      if (normPhone) {
        const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', schoolId).single();
        const schoolName = school?.name ?? 'School';
        void sendWhatsApp({
          to: normPhone,
          body: `Welcome to ${schoolName}!\n\nDear ${body.parent_name ?? 'Parent'},\n\nYour child ${body.name} has been enrolled in Class ${body.class}-${body.section ?? 'A'}.\n\nYour Parent Portal PIN: *${pin}*\n\nUse your phone number + this PIN to access the parent portal.\nPortal: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.edprosys.com'}/parent\n\nReply STOP to unsubscribe.`,
          schoolName,
        }).catch(() => {}); // fire and forget — Promise<WhatsAppResult>.catch() is valid
      }
    }

    await logActivity({
      schoolId,
      action: `Added student: ${body.name} (Class ${body.class})`,
      module: 'import',
      details: { name: body.name, class: body.class, pin_generated: !!pin },
    });

    return NextResponse.json({ success: true, student, pin_generated: !!pin });
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

    // If phone was updated, update parent record too
    if (body.phone_parent !== undefined) {
      const normPhone = normalisePhone(body.phone_parent);
      if (normPhone) {
        await supabaseAdmin.from('parents')
          .update({ phone: normPhone, ...(body.parent_name && { name: body.parent_name }) })
          .eq('student_id', body.id)
          .eq('school_id', schoolId)
          .then(null, () => {});
      }
    }

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

    const { error } = await supabaseAdmin
      .from('students')
      .update({ is_active: false })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw new Error(error.message);

    await logActivity({ schoolId, action: 'Deactivated student (soft delete)', module: 'import', details: { student_id: id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
