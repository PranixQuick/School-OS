// app/api/admin/ptm/[id]/generate-slots/route.ts
// Batch 7 — Auto-generate PTM slots for a session.
// Strategy: DISTINCT (staff_id, class_id) FROM timetable WHERE school_id=X
//           → for each teacher-class pair, cross with students in that class
//           → assign sequential slot times
// Schema: ptm_sessions.date (not session_date); status values: scheduled/...
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

// Convert "HH:MM:SS" or "HH:MM" to total minutes
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Add minutes to "HH:MM" string → "HH:MM"
function addMinutes(base: string, mins: number): string {
  const total = timeToMinutes(base) + mins;
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;
  const { id: sessionId } = await params;

  // Fetch session using actual column name 'date'
  const { data: session, error: sErr } = await supabaseAdmin
    .from('ptm_sessions')
    .select('id, date, start_time, end_time, slot_duration_minutes, status')
    .eq('id', sessionId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (sErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const sessionDate = session.date as string;
  const startMins = timeToMinutes(session.start_time as string);
  const endMins = timeToMinutes(session.end_time as string);
  const duration = (session.slot_duration_minutes as number) ?? 10;

  // Get distinct teacher-class pairs from timetable (school-scoped)
  const { data: ttRows } = await supabaseAdmin
    .from('timetable')
    .select('staff_id, class_id')
    .eq('school_id', schoolId);

  // Deduplicate teacher-class pairs
  const pairs = new Map<string, { staff_id: string; class_id: string }>();
  for (const row of ttRows ?? []) {
    if (row.staff_id && row.class_id) {
      pairs.set(`${row.staff_id}:${row.class_id}`, { staff_id: row.staff_id, class_id: row.class_id });
    }
  }

  if (pairs.size === 0) return NextResponse.json({ generated: 0, message: 'No teacher-class assignments found in timetable' });

  // For each teacher-class pair, fetch students
  const classIds = [...new Set([...pairs.values()].map(p => p.class_id))];
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, class_id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .in('class_id', classIds);

  const studentsByClass = new Map<string, string[]>();
  for (const s of students ?? []) {
    const arr = studentsByClass.get(s.class_id) ?? [];
    arr.push(s.id);
    studentsByClass.set(s.class_id, arr);
  }

  // Generate slot records
  const slotsToInsert: {
    school_id: string; session_id: string; staff_id: string; student_id: string;
    slot_time: string; slot_date: string; status: string; parent_confirmed: boolean;
  }[] = [];

  let slotIndex = 0;
  for (const { staff_id, class_id } of pairs.values()) {
    const classStudents = studentsByClass.get(class_id) ?? [];
    for (const student_id of classStudents) {
      const offsetMins = slotIndex * duration;
      if (startMins + offsetMins >= endMins) break; // past end of session
      const slotTime = addMinutes(session.start_time as string, offsetMins);
      slotsToInsert.push({
        school_id: schoolId,
        session_id: sessionId,
        staff_id,
        student_id,
        slot_time: slotTime,
        slot_date: sessionDate,
        status: 'available',
        parent_confirmed: false,
      });
      slotIndex++;
    }
  }

  if (slotsToInsert.length === 0) return NextResponse.json({ generated: 0, message: 'No slots to generate (check students and timetable data)' });

  // Insert in batches of 100
  let generated = 0;
  for (let i = 0; i < slotsToInsert.length; i += 100) {
    const batch = slotsToInsert.slice(i, i + 100);
    const { error: iErr } = await supabaseAdmin.from('ptm_slots').upsert(batch, { ignoreDuplicates: true });
    if (!iErr) generated += batch.length;
  }

  return NextResponse.json({ generated, total_pairs: pairs.size });
}
