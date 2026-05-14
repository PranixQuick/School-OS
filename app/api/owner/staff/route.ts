// app/api/owner/staff/route.ts
// Batch 4C — All staff across all owned schools.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireOwnerSession, OwnerAuthError } from '@/lib/owner-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireOwnerSession(req); }
  catch (e) { if (e instanceof OwnerAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolIds, schools } = ctx;

  if (!schoolIds.length) return NextResponse.json({ staff: [], count: 0 });

  const { data, error } = await supabaseAdmin
    .from('staff')
    .select('id, school_id, name, email, phone, role, department, is_active')
    .in('school_id', schoolIds)
    .eq('is_active', true)
    .order('school_id', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const schoolNameMap = Object.fromEntries(schools.map(s => [s.school_id, s.school_name]));
  const staff = (data ?? []).map(s => ({ ...s, school_name: schoolNameMap[s.school_id] ?? '?' }));

  return NextResponse.json({ staff, count: staff.length });
}
