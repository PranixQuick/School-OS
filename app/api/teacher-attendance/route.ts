import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  const schoolId = getSchoolId(req);
  try {
    const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0];
    const [attRes, staffRes] = await Promise.all([
      supabaseAdmin.from('teacher_attendance').select('id, staff_id, date, status, check_in_time, marked_via, notes').eq('school_id', schoolId).eq('date', date),
      supabaseAdmin.from('staff').select('id, name, role, subject').eq('school_id', schoolId).eq('is_active', true).order('name'),
    ]);
    if (staffRes.error) throw new Error(staffRes.error.message);
    const attendance = attRes.data ?? [];
    const staff = staffRes.data ?? [];
    const merged = staff.map(s => {
      const att = attendance.find(a => a.staff_id === s.id);
      return { ...s, attendance_id: att?.id ?? null, status: att?.status ?? 'not_marked', check_in_time: att?.check_in_time ?? null, marked_via: att?.marked_via ?? null };
    });
    const summary = { present: attendance.filter(a => a.status === 'present').length, absent: attendance.filter(a => a.status === 'absent').length, late: attendance.filter(a => a.status === 'late').length, not_marked: staff.length - attendance.length };
    return NextResponse.json({ date, staff: merged, summary });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);
  try {
    const body = await req.json() as { staff_id: string; date: string; status: string; check_in_time?: string; notes?: string; marked_via?: string; };
    if (!body.staff_id || !body.date || !body.status) return NextResponse.json({ error: 'staff_id, date, status required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('teacher_attendance').upsert({ school_id: schoolId, staff_id: body.staff_id, date: body.date, status: body.status, check_in_time: body.check_in_time ?? null, notes: body.notes ?? null, marked_via: body.marked_via ?? 'portal' }, { onConflict: 'school_id,staff_id,date' }).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, record: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
