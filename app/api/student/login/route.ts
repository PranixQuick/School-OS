// app/api/student/login/route.ts
// Batch 4D — Student login. admission_number + PIN.
// PIN compared plain-text matching parent auth pattern.
// Sets student_session cookie on success.
// /api/student/login is in middleware PUBLIC_PATHS.

import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentPin, issueStudentSession, studentSessionCookie } from '@/lib/student-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { admission_number, pin, school_id } = body as { admission_number?: string; pin?: string; school_id?: string };
  if (!admission_number || !pin) {
    return NextResponse.json({ error: 'admission_number and pin required' }, { status: 400 });
  }

  let resolvedSchoolId = school_id ?? '';

  // If school_id not provided, look up by admission_number (single match only)
  if (!resolvedSchoolId) {
    const { data: matches } = await supabaseAdmin
      .from('students')
      .select('school_id')
      .eq('admission_number', admission_number)
      .eq('is_active', true)
      .eq('student_login_enabled', true);
    if (!matches?.length) {
      return NextResponse.json({ error: 'Invalid admission number or PIN' }, { status: 401 });
    }
    if (matches.length > 1) {
      return NextResponse.json({ error: 'Multiple schools match. Please provide your school ID.' }, { status: 409 });
    }
    resolvedSchoolId = matches[0].school_id;
  }

  const student = await verifyStudentPin(admission_number, pin, resolvedSchoolId);
  if (!student) {
    return NextResponse.json({ error: 'Invalid admission number or PIN' }, { status: 401 });
  }

  const token = await issueStudentSession(student);
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieCfg = studentSessionCookie(token, isProduction);

  const res = NextResponse.json({
    name: student.name,
    class: student.class,
    section: student.section,
    redirectTo: '/student',
  });
  res.cookies.set(cookieCfg);
  return res;
}
