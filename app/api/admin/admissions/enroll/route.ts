import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// H1: Enroll student from admission inquiry
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { schoolId } = ctx;

  const body = await req.json() as {
    student_name: string; cls: string; section?: string;
    parent_name?: string; parent_phone?: string; parent_email?: string;
    from_inquiry?: string;
  };

  if (!body.student_name || !body.cls) {
    return NextResponse.json({ error: 'student_name and cls are required' }, { status: 400 });
  }

  // 1. Insert student
  const { data: student, error: sErr } = await supabaseAdmin
    .from('students')
    .insert({
      school_id: schoolId,
      name: body.student_name,
      class: body.cls,
      section: body.section ?? 'A',
      is_active: true,
      student_login_enabled: false,
    })
    .select('id')
    .single();

  if (sErr || !student) {
    return NextResponse.json({ error: sErr?.message ?? 'Failed to create student' }, { status: 500 });
  }

  // 2. Create parent if phone provided and not already linked
  if (body.parent_phone) {
    const { data: existing } = await supabaseAdmin
      .from('parents')
      .select('id')
      .eq('school_id', schoolId)
      .eq('phone', body.parent_phone)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from('parents').insert({
        school_id: schoolId,
        name: body.parent_name ?? '',
        phone: body.parent_phone,
        email: body.parent_email ?? null,
        student_id: student.id,
      });
    }
  }

  // 3. Mark inquiry as enrolled
  if (body.from_inquiry) {
    await supabaseAdmin
      .from('inquiries')
      .update({ status: 'enrolled' })
      .eq('id', body.from_inquiry)
      .eq('school_id', schoolId);
  }

  return NextResponse.json({ enrolled: true, student_id: student.id });
}
