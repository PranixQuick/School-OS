// app/api/admin/staff/route.ts
// PR-7: GET list of staff for the admin's school. Used by admin timetable page,
// complaints assignment dropdown, etc.
// Auth: middleware session.
//
// Returns only active staff by default. Pass ?include_inactive=1 to include inactive.

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

  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === '1';
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') ?? '500', 10) || 500, 1), 1000);

  let q = supabaseAdmin
    .from('staff')
    .select('id, name, role, subject, phone, email, is_active')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })
    .limit(limit);

  if (!includeInactive) {
    q = q.eq('is_active', true);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ staff: data ?? [], count: (data ?? []).length });
}
