// app/api/parent/ptm/route.ts
// Batch 7 — Parent: view their children's PTM slots.
// Auth: phone+pin query params (same pattern as /api/parent/fees).
// /api/parent is PUBLIC_PATH — route handler does own auth.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  const pin = req.nextUrl.searchParams.get('pin');
  if (!phone || !pin) return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });

  // Validate parent via phone + access_pin
  const schoolId = req.nextUrl.searchParams.get('school_id') ?? null;
  const { data: parent, error: pErr } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_ids:students!parents_id_fkey(id)')
    .eq('phone', phone.replace(/\D/g, '').replace(/^91/, ''))
    .maybeSingle();

  // Fallback: search with + prefix stripped
  const phoneNorm = phone.startsWith('+') ? phone.slice(1) : phone;
  const { data: parent2 } = !parent
    ? await supabaseAdmin.from('parents').select('id, school_id').eq('phone', phoneNorm).maybeSingle()
    : { data: null };
  const resolvedParent = parent ?? parent2;
  if (!resolvedParent) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  // Verify PIN
  const { data: pinRow } = await supabaseAdmin
    .from('parents').select('access_pin').eq('id', resolvedParent.id).maybeSingle();
  if (!pinRow || String(pinRow.access_pin) !== String(pin))
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const parentSchoolId = resolvedParent.school_id as string;

  // Get students linked to this parent
  const { data: studentLinks } = await supabaseAdmin
    .from('students')
    .select('id, name')
    .eq('school_id', parentSchoolId)
    .contains('parent_ids', [resolvedParent.id]);

  // Fallback: find via parents table
  const { data: linkedStudents } = !studentLinks?.length
    ? await supabaseAdmin.from('students').select('id, name')
        .eq('school_id', parentSchoolId)
        .eq('primary_parent_id', resolvedParent.id)
    : { data: null };

  const students = studentLinks?.length ? studentLinks : (linkedStudents ?? []);
  if (!students.length) return NextResponse.json({ slots: [], message: 'No students linked to this parent' });

  const studentIds = students.map(s => s.id);

  // Fetch PTM slots for these students
  const { data: slots, error: slErr } = await supabaseAdmin
    .from('ptm_slots')
    .select('id, slot_time, slot_date, status, parent_confirmed, notes, booked_at, staff_id, session_id, student_id')
    .eq('school_id', parentSchoolId)
    .in('student_id', studentIds)
    .order('slot_date', { ascending: true })
    .order('slot_time', { ascending: true });
  if (slErr) return NextResponse.json({ error: slErr.message }, { status: 500 });

  if (!slots || slots.length === 0) return NextResponse.json({ slots: [] });

  // Enrich with session + staff names
  const sessionIds = [...new Set(slots.map(s => s.session_id).filter(Boolean))];
  const staffIds = [...new Set(slots.map(s => s.staff_id).filter(Boolean))];

  const [sessRes, staffRes] = await Promise.all([
    supabaseAdmin.from('ptm_sessions').select('id, title, date').in('id', sessionIds),
    supabaseAdmin.from('staff').select('id, name').in('id', staffIds),
  ]);
  const sessMap = new Map((sessRes.data ?? []).map(s => [s.id, s]));
  const staffMap = new Map((staffRes.data ?? []).map(s => [s.id, s.name]));
  const studentMap = new Map(students.map(s => [s.id, s.name]));

  const enriched = slots.map(slot => ({
    ...slot,
    session_title: sessMap.get(slot.session_id)?.title ?? null,
    date: sessMap.get(slot.session_id)?.date ?? slot.slot_date,
    teacher_name: staffMap.get(slot.staff_id) ?? 'Unknown',
    student_name: studentMap.get(slot.student_id) ?? 'Unknown',
  }));

  return NextResponse.json({ slots: enriched });
}
