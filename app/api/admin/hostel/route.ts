// app/api/admin/hostel/route.ts
// Hostel management: rooms inventory, student allocation, occupancy dashboard
// Real workflow: warden assigns room at admission; checks availability manually
// No complex room bidding or online booking — purely administrative assignment
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const instId = school?.institution_id ?? schoolId;

  const view = req.nextUrl.searchParams.get('view'); // 'rooms' | 'allocations' | 'occupancy'

  if (view === 'allocations') {
    const { data, error } = await supabaseAdmin
      .from('hostel_allocations')
      .select('id, student_id, room_id, check_in_date, check_out_date, status, fee_amount, notes, student:student_id(name, class, section), room:room_id(block, room_number, room_type)')
      .eq('institution_id', instId)
      .eq('status', 'active')
      .order('check_in_date', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ allocations: data ?? [] });
  }

  // Default: rooms with occupancy
  const { data: rooms, error } = await supabaseAdmin
    .from('hostel_rooms')
    .select('id, block, room_number, capacity, room_type, floor, is_active, notes')
    .eq('institution_id', instId)
    .eq('is_active', true)
    .order('block').order('room_number');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get current occupancy per room
  const roomIds = (rooms ?? []).map(r => r.id);
  let occupancy: Record<string, number> = {};
  if (roomIds.length > 0) {
    const { data: allocs } = await supabaseAdmin
      .from('hostel_allocations')
      .select('room_id')
      .in('room_id', roomIds)
      .eq('status', 'active');
    for (const a of allocs ?? []) occupancy[a.room_id] = (occupancy[a.room_id] ?? 0) + 1;
  }

  const roomsWithOccupancy = (rooms ?? []).map(r => ({
    ...r, occupied: occupancy[r.id] ?? 0, available: r.capacity - (occupancy[r.id] ?? 0),
  }));

  return NextResponse.json({ rooms: roomsWithOccupancy });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const instId = school?.institution_id ?? schoolId;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body.action === 'allocate') {
    // Assign student to room
    const { student_id, room_id, check_in_date, fee_amount, notes } = body;
    if (!student_id || !room_id) {
      return NextResponse.json({ error: 'student_id and room_id required' }, { status: 400 });
    }
    // Check room has space
    const { count: occupied } = await supabaseAdmin
      .from('hostel_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', String(room_id)).eq('status', 'active');
    const { data: room } = await supabaseAdmin
      .from('hostel_rooms').select('capacity, block, room_number').eq('id', String(room_id)).maybeSingle();
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if ((occupied ?? 0) >= room.capacity) {
      return NextResponse.json({ error: `Room ${room.block}-${room.room_number} is full` }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin.from('hostel_allocations').insert({
      institution_id: instId, school_id: schoolId,
      student_id: String(student_id), room_id: String(room_id),
      check_in_date: check_in_date ? String(check_in_date) : new Date().toISOString().split('T')[0],
      fee_amount: fee_amount ? Number(fee_amount) : null,
      notes: notes ? String(notes) : null,
      status: 'active',
    }).select('id, student_id, room_id, check_in_date, status').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, allocation: data });
  }

  // Add a new room
  const { block, room_number, capacity, room_type, floor, notes } = body;
  if (!block || !room_number) return NextResponse.json({ error: 'block and room_number required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('hostel_rooms').insert({
    institution_id: instId, school_id: schoolId,
    block: String(block).trim(), room_number: String(room_number).trim(),
    capacity: capacity ? Number(capacity) : 2,
    room_type: String(room_type ?? 'shared'),
    floor: floor ? Number(floor) : null,
    notes: notes ? String(notes) : null,
    is_active: true,
  }).select('id, block, room_number, capacity').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, room: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, action: hostelAction } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (hostelAction === 'checkout') {
    const today = new Date().toISOString().split('T')[0];
    await supabaseAdmin.from('hostel_allocations')
      .update({ status: 'vacated', check_out_date: today })
      .eq('id', String(id));
    return NextResponse.json({ success: true, message: 'Student checked out' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
