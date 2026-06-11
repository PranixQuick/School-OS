import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { writeNotification } from '@/lib/notifications';

// H1: Enroll student from admission inquiry.
//
// Certification fixes (live-test verified defects):
//   1. Idempotency — re-POSTing created duplicate students. Now: an inquiry can
//      only be converted once (409 if already 'admitted'), and an identical
//      active student (name+class+section) blocks with 409 unless
//      allow_duplicate=true is passed for genuine same-name children.
//   2. inquiries.status was set to 'enrolled', which VIOLATES the DB CHECK
//      ('new'|'contacted'|'visit_scheduled'|'admitted'|'lost') — the update
//      silently failed on every enrollment, so the pipeline never closed.
//      Correct value is 'admitted', and the result is now checked + surfaced.
//   3. No notification on enrollment (systemic gap) — now writes a school
//      notification (module 'admissions').
//   4. parents has UNIQUE(school_id, phone) and parent login rejects duplicate
//      phones, so a second child CANNOT be linked to an existing parent phone
//      under the current model. We surface parent_linked/parent_note honestly
//      instead of silently skipping.
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
    allow_duplicate?: boolean;
  };

  if (!body.student_name || !body.cls) {
    return NextResponse.json({ error: 'student_name and cls are required' }, { status: 400 });
  }
  const section = body.section ?? 'A';

  // 0a. Idempotency: an inquiry converts to a student exactly once.
  if (body.from_inquiry) {
    const { data: inquiry, error: iqErr } = await supabaseAdmin
      .from('inquiries')
      .select('id, status')
      .eq('id', body.from_inquiry)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (iqErr) return NextResponse.json({ error: iqErr.message }, { status: 500 });
    if (!inquiry) return NextResponse.json({ error: 'Inquiry not found for this school' }, { status: 404 });
    if (inquiry.status === 'admitted') {
      return NextResponse.json({ error: 'This inquiry has already been enrolled' }, { status: 409 });
    }
  }

  // 0b. Duplicate-student guard: identical active name+class+section is almost
  // always a double-submit. allow_duplicate=true overrides for genuine cases.
  if (!body.allow_duplicate) {
    const { data: dups } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', body.student_name)
      .eq('class', body.cls)
      .eq('section', section)
      .eq('is_active', true)
      .limit(1);
    if (dups && dups.length > 0) {
      return NextResponse.json({
        error: `An active student named '${body.student_name}' already exists in Class ${body.cls}-${section}. Pass allow_duplicate=true if this is genuinely a different child.`,
        existing_student_id: dups[0].id,
      }, { status: 409 });
    }
  }

  // 1. Insert student
  const { data: student, error: sErr } = await supabaseAdmin
    .from('students')
    .insert({
      school_id: schoolId,
      name: body.student_name,
      class: body.cls,
      section,
      is_active: true,
      student_login_enabled: false,
    })
    .select('id')
    .single();

  if (sErr || !student) {
    return NextResponse.json({ error: sErr?.message ?? 'Failed to create student' }, { status: 500 });
  }

  // 2. Parent linkage. DB enforces UNIQUE(school_id, phone) and parent login
  // rejects duplicate phones — so when a parent row already exists for this
  // phone, the new student cannot be attached to it under the current model.
  // Surface that honestly instead of silently doing nothing.
  let parentLinked = false;
  let parentNote: string | null = null;
  if (body.parent_phone) {
    const { data: existing } = await supabaseAdmin
      .from('parents')
      .select('id, student_id')
      .eq('school_id', schoolId)
      .eq('phone', body.parent_phone)
      .maybeSingle();

    if (!existing) {
      const { error: pErr } = await supabaseAdmin.from('parents').insert({
        school_id: schoolId,
        name: body.parent_name ?? '',
        phone: body.parent_phone,
        email: body.parent_email ?? null,
        student_id: student.id,
      });
      if (pErr) {
        parentNote = `Parent record could not be created: ${pErr.message}`;
      } else {
        parentLinked = true;
      }
    } else {
      parentNote = 'A parent account with this phone already exists and is linked to another student. ' +
        'The platform currently supports one student per parent phone — this new student will NOT appear in that parent portal. ' +
        'Use a different contact number for this student, or contact support about multi-child accounts.';
    }
  }

  // 3. Close the pipeline: mark inquiry 'admitted' (allowed by the DB CHECK).
  let inquiryMarked = false;
  if (body.from_inquiry) {
    const { error: updErr } = await supabaseAdmin
      .from('inquiries')
      .update({ status: 'admitted' })
      .eq('id', body.from_inquiry)
      .eq('school_id', schoolId);
    inquiryMarked = !updErr;
  }

  // 4. Notify the school (best-effort): admissions event visible to office/principal.
  try {
    await writeNotification(supabaseAdmin, {
      school_id: schoolId,
      type: 'system',
      title: 'New student enrolled',
      message: `${body.student_name} has been enrolled in Class ${body.cls}-${section}.`,
      module: 'admissions',
      reference_id: student.id,
      channel: 'none',
    });
  } catch { /* best-effort */ }

  return NextResponse.json({
    enrolled: true,
    student_id: student.id,
    parent_linked: parentLinked,
    ...(parentNote ? { parent_note: parentNote } : {}),
    ...(body.from_inquiry ? { inquiry_marked: inquiryMarked } : {}),
  });
}
