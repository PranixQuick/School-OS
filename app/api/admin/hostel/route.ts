// app/api/admin/hostel/route.ts
// Real workflow: warden adds rooms, allocates students, tracks occupancy
// Simple CRUD. No portal for students — they check via parent portal or admin office.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ rooms: [], occupancy: 0 });

  const view = req.nextUrl.searchParams.get('view') ?? 'rooms';

  if (view === 'allocations') {
    const { data, error } = await supabaseAdmin
      .from('hostel_allocations')
      .select('*, room:hostel_rooms(block, room_number, capacity), student:students(name, class, section)')
      .eq('institution_id', school.institution_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ allocations: data ?? [] });
  }

  // Default: rooms view with occupancy
  const { data: rooms, error: rErr } = await supabaseAdmin
    .from('hostel_rooms')
    .select('*')
    .eq('institution_id', school.institution_id)
    .eq('is_active', true)
    .order('block, room_number');
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  // Get current occupancy counts per room
  const roomIds = (rooms ?? []).map(r => r.id);
  const { data: allocs } = await supabaseAdmin
    .from('hostel_allocations').select('room_id')
    .in('room_id', roomIds).eq('status', 'active');

  const occupancy: Record<string, number> = {};
  for (const a of allocs ?? []) occupancy[a.room_id] = (occupancy[a.room_id] ?? 0) + 1;

  const roomsWithOccupancy = (rooms ?? []).map(r => ({
    ...r,
    current_occupancy: occupancy[r.id] ?? 0,
    available: r.capacity - (occupancy[r.id] ?? 0),
  }));

  return NextResponse.json({ rooms: roomsWithOccupancy });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { action: 'add_room' | 'allocate' | 'vacate'; [key: string]: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  if (body.action === 'add_room') {
    const { block, room_number, capacity, room_type } = body as any;
    if (!block || !room_number) return NextResponse.json({ error: 'block and room_number required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('hostel_rooms').insert({
      institution_id: school.institution_id, school_id: schoolId,
      block, room_number, capacity: capacity ?? 2, room_type: room_type ?? 'shared',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, room: data });
  }

  if (body.action === 'allocate') {
    const { room_id, student_id, check_in_date, fee_amount, academic_year_id } = body as any;
    if (!room_id || !student_id || !check_in_date) return NextResponse.json({ error: 'room_id, student_id, check_in_date required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('hostel_allocations').insert({
      institution_id: school.institution_id, school_id: schoolId,
      room_id, student_id, check_in_date,
      fee_amount: fee_amount ?? null,
      academic_year_id: academic_year_id ?? null,
      status: 'active',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, allocation: data });
  }

  if (body.action === 'vacate') {
    const { allocation_id, check_out_date } = body as any;
    if (!allocation_id) return NextResponse.json({ error: 'allocation_id required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('hostel_allocations')
      .update({ status: 'vacated', check_out_date: check_out_date ?? new Date().toISOString().split('T')[0] })
      .eq('id', allocation_id).eq('institution_id', school.institution_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
