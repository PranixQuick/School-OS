// app/api/parent/ptm/[slot_id]/confirm/route.ts
// Batch 7 — Parent confirms a PTM slot.
// Auth: phone+pin in request body. Validates slot belongs to parent's student.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slot_id: string }> }
) {
  const { slot_id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { phone, pin } = body as { phone?: string; pin?: string };
  if (!phone || !pin) return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });

  // Validate parent
  const phoneClean = phone.replace(/\D/g, '').replace(/^91/, '');
  const { data: parent } = await supabaseAdmin
    .from('parents').select('id, school_id, access_pin').eq('phone', phoneClean).maybeSingle();
  if (!parent || String(parent.access_pin) !== String(pin))
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const schoolId = parent.school_id as string;

  // Get the slot
  const { data: slot } = await supabaseAdmin
    .from('ptm_slots').select('id, student_id, slot_time, slot_date, session_id, staff_id, parent_confirmed')
    .eq('id', slot_id).eq('school_id', schoolId).maybeSingle();
  if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });

  // Verify slot belongs to parent's student
  const { data: student } = await supabaseAdmin
    .from('students').select('id, name')
    .eq('id', slot.student_id).eq('school_id', schoolId)
    .eq('primary_parent_id', parent.id).maybeSingle();
  // Fallback: check parent_ids array
  const { data: student2 } = !student
    ? await supabaseAdmin.from('students').select('id, name')
        .eq('id', slot.student_id).eq('school_id', schoolId)
        .contains('parent_ids', [parent.id]).maybeSingle()
    : { data: null };
  if (!student && !student2)
    return NextResponse.json({ error: 'Not authorized for this slot' }, { status: 403 });

  const studentData = student ?? student2;

  // Confirm the slot
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('ptm_slots')
    .update({ parent_confirmed: true, booked_at: new Date().toISOString() })
    .eq('id', slot_id).eq('school_id', schoolId)
    .select('id, slot_time, slot_date, parent_confirmed, booked_at, staff_id, session_id')
    .single();
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Fetch teacher name + session title
  const [staffRes, sessRes] = await Promise.all([
    supabaseAdmin.from('staff').select('name').eq('id', slot.staff_id).maybeSingle(),
    supabaseAdmin.from('ptm_sessions').select('title, date').eq('id', slot.session_id).maybeSingle(),
  ]);

  // Non-fatal notification
  try {
    await supabaseAdmin.from('notifications').insert({
      school_id: schoolId,
      type: 'broadcast',
      module: 'ptm',
      title: 'PTM slot confirmed',
      message: `PTM slot confirmed for ${studentData?.name ?? 'student'} with ${staffRes.data?.name ?? 'teacher'} on ${updated.slot_date ?? sessRes.data?.date ?? ''} at ${updated.slot_time}`,
      status: 'pending',
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    confirmed: true,
    slot_time: updated.slot_time,
    date: updated.slot_date ?? sessRes.data?.date,
    session_title: sessRes.data?.title,
    teacher_name: staffRes.data?.name ?? 'Unknown',
  });
}
