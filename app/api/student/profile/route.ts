// app/api/student/profile/route.ts
// Batch 4D — Student profile.

import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession, studentAuthResponse } from '@/lib/student-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireStudentSession(req); }
  catch (e) { return studentAuthResponse(e); }

  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id, name, class, section, roll_number, admission_number, date_of_birth, parent_name, phone_parent')
    .eq('id', session.studentId)
    .eq('school_id', session.schoolId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  return NextResponse.json({ profile: data });
}
