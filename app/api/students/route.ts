import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { supabaseForUser as _supabaseForUser } from '@/lib/supabaseForUser';
import { getSession } from '@/lib/auth';
import { getInstitutionForSchool } from '@/lib/tenant-lookup';
import { logActivity } from '@/lib/logger';
import { sendWhatsApp, normalisePhone } from '@/lib/whatsapp';

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function noSession() {
  return NextResponse.json({ error: 'No session' }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return noSession();
  const schoolId = session.schoolId;

  const classFilter = req.nextUrl.searchParams.get('class');
  const section = req.nextUrl.searchParams.get('section');
  const search = req.nextUrl.searchParams.get('search');
  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true';
  const idFilter = req.nextUrl.searchParams.get('id');

  let query = supabaseAdmin
    .from('students')
    .select('id, name, class, section, roll_number, admission_number, phone_parent, parent_name, date_of_birth, is_active, created_at, school_id')
    .eq('school_id', schoolId)
    .order('class', { ascending: true })
    .order('name', { ascending: true });

  if (!includeInactive) query = query.eq('is_active', true);
  if (idFilter) query = query.eq('id', idFilter);
  if (classFilter) query = query.eq('class', classFilter);
  if (section) query = query.eq('section', section);
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data ?? [], total: (data ?? []).length });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return noSession();
  const schoolId = session.schoolId;

  const body = await req.json().catch(() => null) as {
    name: string; class: string; section?: string;
    roll_number?: string; admission_number?: string;
    phone_parent?: string; parent_name?: string; date_of_birth?: string;
  } | null;
  if (!body || !body.name || !body.class) {
    return NextResponse.json({ error: 'name and class are required' }, { status: 400 });
  }

  const instCtx = await getInstitutionForSchool(schoolId);
  const { data: student, error } = await supabaseAdmin.from('students').insert({
    school_id: schoolId,
    institution_id: instCtx.institution_id,
    academic_year_id: instCtx.academic_year_id,
    name: body.name, class: body.class, section: body.section ?? 'A',
    roll_number: body.roll_number ?? null, admission_number: body.admission_number ?? null,
    phone_parent: body.phone_parent ?? null, parent_name: body.parent_name ?? null,
    date_of_birth: body.date_of_birth ?? null, is_active: true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let pin: string | null = null;
  if (body.phone_parent) {
    pin = generatePin();
    await supabaseAdmin.from('parents').upsert({
      school_id: schoolId, student_id: student.id, name: body.parent_name ?? 'Parent',
      phone: normalisePhone(body.phone_parent) ?? body.phone_parent, access_pin: pin, whatsapp_opted_out: false,
    }, { onConflict: 'school_id,student_id' }).then(null, (e: unknown) => { console.error('Parent upsert error:', e); });

    const normPhone = normalisePhone(body.phone_parent);
    if (normPhone) {
      const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', schoolId).single();
      void sendWhatsApp({ to: normPhone,
        body: `Welcome to ${school?.name ?? 'School'}!\n\nYour child ${body.name} has been enrolled in Class ${body.class}-${body.section ?? 'A'}.\n\nYour Parent Portal PIN: *${pin}*\n\nPortal: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.edprosys.com'}/parent`,
        schoolName: school?.name ?? 'School' }).catch(() => {});
    }
  }

  await logActivity({ schoolId, action: `Added student: ${body.name} (Class ${body.class})`, module: 'import', details: { name: body.name, class: body.class, pin_generated: !!pin } });
  return NextResponse.json({ success: true, student, pin_generated: !!pin });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return noSession();
  const schoolId = session.schoolId;

  const body = await req.json().catch(() => null) as {
    id: string; name?: string; class?: string; section?: string;
    roll_number?: string; admission_number?: string;
    phone_parent?: string; parent_name?: string; date_of_birth?: string; is_active?: boolean;
  } | null;
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('students').update({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.class !== undefined && { class: body.class }),
    ...(body.section !== undefined && { section: body.section }),
    ...(body.roll_number !== undefined && { roll_number: body.roll_number }),
    ...(body.admission_number !== undefined && { admission_number: body.admission_number }),
    ...(body.phone_parent !== undefined && { phone_parent: body.phone_parent }),
    ...(body.parent_name !== undefined && { parent_name: body.parent_name }),
    ...(body.date_of_birth !== undefined && { date_of_birth: body.date_of_birth }),
    ...(body.is_active !== undefined && { is_active: body.is_active }),
  }).eq('id', body.id).eq('school_id', schoolId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.phone_parent !== undefined) {
    const normPhone = normalisePhone(body.phone_parent);
    if (normPhone) {
      await supabaseAdmin.from('parents').update({ phone: normPhone, ...(body.parent_name && { name: body.parent_name }) }).eq('student_id', body.id).eq('school_id', schoolId).then(null, () => {});
    }
  }
  return NextResponse.json({ success: true, student: data });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return noSession();
  const schoolId = session.schoolId;

  const body = await req.json().catch(() => null) as { id: string } | null;
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('students').update({ is_active: false }).eq('id', body.id).eq('school_id', schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({ schoolId, action: 'Deactivated student', module: 'import', details: { student_id: body.id } });
  return NextResponse.json({ success: true });
}
