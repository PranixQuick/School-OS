// app/api/admin/subjects/route.ts
// PR-7: GET list of subjects for the admin's school.
// Used by the admin timetable page.
// Auth: middleware session.

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
    .from('subjects')
    .select('id, code, name, board_alignment')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ subjects: data ?? [], count: (data ?? []).length });
}
