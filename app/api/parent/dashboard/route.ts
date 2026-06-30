// app/api/parent/dashboard/route.ts
// Parent portal dashboard — returns all children linked to this parent account.
// Multi-child: fetches all parent_students rows and returns full student data for each.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all children linked to this parent (multi-child support)
    const { data: links } = await supabaseAdmin
      .from('parent_students')
      .select('student_id, school_id, relationship, is_primary')
      .eq('parent_id', session.parentId)
      .order('is_primary', { ascending: false }); // primary first

    // If no parent_students rows, fall back to the session's direct student (DASH-01).
    // NOTE: a successful query with no rows returns `[]`, which is NOT nullish, so a plain
    // `links?.map(...) ?? [session.studentId]` would keep the empty array and 404 every legacy
    // single-child parent. Guard on length so the fallback actually fires.
    const studentIds = (links && links.length > 0) ? links.map(l => l.student_id) : [session.studentId];
    const primaryStudentId = links?.find(l => l.is_primary)?.student_id ?? session.studentId;

    // Fetch student details for all children
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, name, class, section, roll_number, admission_number, school_id')
      .in('id', studentIds)
      .eq('is_active', true);

    if (!students || students.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Primary student (for backward compat — single child callers still work)
    const primaryStudent = students.find(s => s.id === primaryStudentId) ?? students[0];
    const schoolId = primaryStudent.school_id;

    // Fetch school name
    const { data: school } = await supabaseAdmin
      .from('schools').select('name').eq('id', schoolId).single();

    // Attendance for primary student
    const { data: attRows } = await supabaseAdmin
      .from('attendance')
      .select('status')
      .eq('student_id', primaryStudent.id)
      .eq('school_id', schoolId)
      .order('date', { ascending: false })
      .limit(90);

    const totalDays    = attRows?.length ?? 0;
    const presentDays  = attRows?.filter(r => r.status === 'present').length ?? 0;
    const presentPct   = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // Fee summary for primary student
    const { data: feeRows } = await supabaseAdmin
      .from('fees')
      .select('amount, status')
      .eq('student_id', primaryStudent.id)
      .eq('school_id', schoolId)
      .in('status', ['pending', 'overdue']);

    const pendingAmount = feeRows?.reduce((s, f) => s + Number(f.amount), 0) ?? 0;
    const isOverdue = feeRows?.some(f => f.status === 'overdue') ?? false;

    // Notices / broadcasts
    const { data: notices } = await supabaseAdmin
      .from('broadcasts')
      .select('id, title, message, created_at')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      // Primary student data (backward compatible)
      student: {
        name:             primaryStudent.name,
        class:            primaryStudent.class,
        section:          primaryStudent.section,
        roll_number:      primaryStudent.roll_number,
        admission_number: primaryStudent.admission_number,
      },
      attendance: {
        present_pct:  presentPct,
        total_days:   totalDays,
        present_days: presentDays,
      },
      fee: {
        pending_amount: pendingAmount,
        overdue:        isOverdue,
      },
      notices:    notices ?? [],
      school_name: school?.name ?? '',

      // Multi-child: full list of all children
      children: students.map(s => ({
        id:           s.id,
        name:         s.name,
        class:        s.class,
        section:      s.section,
        roll_number:  s.roll_number,
        school_id:    s.school_id,
        is_primary:   s.id === primaryStudentId,
      })),
      active_child_id: primaryStudentId,
    });

  } catch (err) {
    console.error('[parent/dashboard]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
