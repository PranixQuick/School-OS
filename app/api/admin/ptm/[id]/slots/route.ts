// app/api/admin/ptm/[id]/slots/route.ts
// Batch 7 — GET slots for a PTM session, joined with staff + student names.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return { schoolId: (await requireAdminSession(req)).schoolId }; }
  catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try { return { schoolId: (await requirePrincipalSession(req)).schoolId }; }
    catch (pe) { if (pe instanceof PrincipalAuthError) return null; throw pe; }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;
  const { id: sessionId } = await params;

  const { data: slots, error } = await supabaseAdmin
    .from('ptm_slots')
    .select('id, slot_time, slot_date, status, parent_confirmed, notes, booked_at, staff_id, student_id')
    .eq('session_id', sessionId)
    .eq('school_id', schoolId)
    .order('slot_time', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!slots || slots.length === 0) return NextResponse.json({ slots: [] });

  // Enrich with names
  const staffIds = [...new Set(slots.map(s => s.staff_id).filter(Boolean))];
  const studentIds = [...new Set(slots.map(s => s.student_id).filter(Boolean))];

  const [staffRes, studentRes] = await Promise.all([
    supabaseAdmin.from('staff').select('id, name').in('id', staffIds),
    supabaseAdmin.from('students').select('id, name, roll_number').in('id', studentIds),
  ]);
  const staffMap = new Map((staffRes.data ?? []).map(s => [s.id, s.name]));
  const studentMap = new Map((studentRes.data ?? []).map(s => [s.id, { name: s.name, roll_number: s.roll_number }]));

  const enriched = slots.map(slot => ({
    ...slot,
    staff_name: staffMap.get(slot.staff_id) ?? 'Unknown',
    student_name: studentMap.get(slot.student_id)?.name ?? 'Unknown',
    student_roll: studentMap.get(slot.student_id)?.roll_number ?? null,
  }));

  return NextResponse.json({ slots: enriched });
}
