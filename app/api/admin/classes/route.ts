// app/api/admin/classes/route.ts
// PR-7: GET list of classes for the admin's school.
// Used by the admin timetable page (and future scheduling tools).
// Auth: middleware session (x-school-id, x-user-role). Roles: any admin role.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id, grade_level, section, class_teacher_id, capacity')
    .eq('school_id', schoolId)
    .order('grade_level', { ascending: true })
    .order('section', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ classes: data ?? [], count: (data ?? []).length });
}
