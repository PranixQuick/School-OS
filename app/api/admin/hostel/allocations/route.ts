// app/api/admin/hostel/allocations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('hostel_allocations')
    .select('id, status, check_in_date, check_out_date, fee_amount, student:student_id(name, class), room:room_id(room_number, block)')
    .eq('school_id', session.schoolId)
    .eq('status', 'active')
    .order('check_in_date', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ allocations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner'].includes(session.userRole)) return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  let body: { room_id?: string; student_id?: string; fee_amount?: number } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.room_id || !body?.student_id) return NextResponse.json({ error: 'room_id and student_id required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('hostel_allocations').insert({
    school_id: session.schoolId,
    room_id: body.room_id,
    student_id: body.student_id,
    check_in_date: new Date().toISOString().split('T')[0],
    fee_amount: body.fee_amount ?? 0,
    status: 'active',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, allocation: data });
}
