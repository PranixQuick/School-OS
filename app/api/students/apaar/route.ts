// app/api/students/apaar/route.ts
// Bible Phase 7 Step 7.1: APAAR ID management for students.
//
// POST — set/update a student's APAAR, ABC, and DigiLocker IDs.
// GET  — retrieve APAAR status for a student or list students missing APAAR.
//
// APAAR (Automated Permanent Academic Account Registry) is the 12-digit
// national student ID mandated by the Government of India for 2026.
// ABC (Academic Bank of Credits) and DigiLocker are companion identifiers.
//
// Current implementation: manual entry by admin/principal. The columns were
// added in Phase 1 Step 1.3 (apaar_id, abc_id, digilocker_id on students).
//
// Future: DigiLocker e-KYC → ABC registration → APAAR auto-generation
// via the ABC Portal API (when the government API becomes available for
// integration). This route is structured to support that upgrade.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  // Only admin, principal, registrar can manage APAAR IDs
  if (!['admin', 'principal', 'registrar', 'super_admin'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }

  const body = await req.json() as {
    student_id?: string;
    apaar_id?: string;
    abc_id?: string;
    digilocker_id?: string;
  };

  if (!body.student_id) {
    return NextResponse.json({ error: 'student_id is required' }, { status: 400 });
  }

  // Validate APAAR format: 12 digits (when provided)
  if (body.apaar_id !== undefined && body.apaar_id !== null && body.apaar_id !== '') {
    const cleaned = body.apaar_id.replace(/\s+/g, '');
    if (!/^\d{12}$/.test(cleaned)) {
      return NextResponse.json({
        error: 'APAAR ID must be exactly 12 digits',
        hint: 'Example: 123456789012',
      }, { status: 400 });
    }
    body.apaar_id = cleaned;
  }

  // Verify student belongs to caller's school
  const { data: student, error: studentErr } = await supabaseAdmin
    .from('students')
    .select('id, name, class, section, apaar_id, abc_id, digilocker_id')
    .eq('id', body.student_id)
    .eq('school_id', session.schoolId)
    .maybeSingle();

  if (studentErr || !student) {
    return NextResponse.json({ error: 'Student not found in your school' }, { status: 404 });
  }

  // Build update payload — only update fields that were provided
  const updates: Record<string, unknown> = {};
  if (body.apaar_id !== undefined) updates.apaar_id = body.apaar_id || null;
  if (body.abc_id !== undefined) updates.abc_id = body.abc_id || null;
  if (body.digilocker_id !== undefined) updates.digilocker_id = body.digilocker_id || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update — provide apaar_id, abc_id, or digilocker_id' }, { status: 400 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from('students')
    .update(updates)
    .eq('id', body.student_id)
    .eq('school_id', session.schoolId);

  if (updateErr) {
    // Handle unique constraint violation on apaar_id
    if (updateErr.message?.includes('idx_students_apaar_unique') || updateErr.code === '23505') {
      return NextResponse.json({
        error: 'This APAAR ID is already assigned to another student',
        hint: 'Each APAAR ID must be unique nationally',
      }, { status: 409 });
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    student_id: body.student_id,
    student_name: student.name,
    apaar_id: body.apaar_id ?? student.apaar_id,
    abc_id: body.abc_id ?? student.abc_id,
    digilocker_id: body.digilocker_id ?? student.digilocker_id,
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const studentId = req.nextUrl.searchParams.get('student_id');
  const filter = req.nextUrl.searchParams.get('filter'); // 'missing' | 'assigned' | null

  if (studentId) {
    // Single student APAAR lookup
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('id, name, class, section, apaar_id, abc_id, digilocker_id')
      .eq('id', studentId)
      .eq('school_id', session.schoolId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({
      student: data,
      has_apaar: !!data.apaar_id,
      has_abc: !!data.abc_id,
      has_digilocker: !!data.digilocker_id,
    });
  }

  // List students with APAAR filter
  let query = supabaseAdmin
    .from('students')
    .select('id, name, class, section, apaar_id, abc_id, digilocker_id')
    .eq('school_id', session.schoolId)
    .eq('is_active', true)
    .order('class')
    .order('section')
    .order('name');

  if (filter === 'missing') {
    query = query.is('apaar_id', null);
  } else if (filter === 'assigned') {
    query = query.not('apaar_id', 'is', null);
  }

  const { data, error, count } = await query.limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const students = data ?? [];
  const totalMissing = students.filter(s => !s.apaar_id).length;
  const totalAssigned = students.filter(s => !!s.apaar_id).length;

  return NextResponse.json({
    students,
    total: students.length,
    apaar_assigned: totalAssigned,
    apaar_missing: totalMissing,
    compliance_pct: students.length > 0
      ? Math.round((totalAssigned / students.length) * 100)
      : 0,
  });
}
