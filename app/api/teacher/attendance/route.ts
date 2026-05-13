// app/api/teacher/attendance/route.ts
// Teacher attendance marking + retrieval.
//
// POST: mark attendance for a class on a date.
//   Body: { class: string, section: string, date?: string, records: [{student_id, status}] }
//   Unique constraint: attendance_school_student_date_unique (school_id, student_id, date)
//   ON CONFLICT DO UPDATE status, marked_by, marked_via.
//   After marks: notify parents of absent/late students via notifications table.
//
// GET: list students for a class + their attendance status for a given date.
//   Query: ?class=X&section=Y&date=YYYY-MM-DD
//
// Auth: requireTeacherSession
// NOTE: attendance has no class_id — class stored as TEXT on students.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const VALID_STATUSES = new Set(['present','absent','late','excused']);

// ─── POST: mark attendance ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireTeacherSession(req); }
  catch (e) { if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { class: studentClass, section, date: dateParam, records } = body as Record<string, unknown>;

  if (!studentClass || typeof studentClass !== 'string') return NextResponse.json({ error: 'class required' }, { status: 400 });
  if (!Array.isArray(records) || records.length === 0) return NextResponse.json({ error: 'records array required' }, { status: 400 });

  // Date validation — default today, max 7 days in past
  const today = new Date().toISOString().slice(0, 10);
  const date = (typeof dateParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) ? dateParam : today;
  const dateDiff = (new Date(today).getTime() - new Date(date).getTime()) / 86400000;
  if (dateDiff > 7) return NextResponse.json({ error: 'Cannot mark attendance more than 7 days in the past' }, { status: 400 });
  if (dateDiff < 0) return NextResponse.json({ error: 'Cannot mark attendance for a future date' }, { status: 400 });

  // Validate all student_ids belong to this school + class
  const studentIds: string[] = records.map((r: Record<string, unknown>) => r.student_id as string);
  const { data: validStudents } = await supabaseAdmin.from('students')
    .select('id, name, phone_parent')
    .eq('school_id', schoolId).in('id', studentIds);
  const validSet = new Set((validStudents ?? []).map(s => s.id));
  const invalidIds = studentIds.filter(id => !validSet.has(id));
  if (invalidIds.length > 0) return NextResponse.json({ error: `Student IDs not found in school: ${invalidIds.join(', ')}` }, { status: 400 });

  // Upsert attendance records
  let saved = 0;
  let absentNotified = 0;
  const absentRecords: { student_id: string; status: string }[] = [];

  for (const rec of records as { student_id: string; status: string }[]) {
    if (!VALID_STATUSES.has(rec.status)) continue;
    const { data: existing } = await supabaseAdmin.from('attendance')
      .select('id').eq('school_id', schoolId).eq('student_id', rec.student_id).eq('date', date).maybeSingle();

    if (existing) {
      await supabaseAdmin.from('attendance').update({
        status: rec.status, marked_by: staffId, marked_via: 'teacher_dashboard',
      }).eq('id', existing.id).eq('school_id', schoolId);
    } else {
      await supabaseAdmin.from('attendance').insert({
        school_id: schoolId, student_id: rec.student_id,
        date, status: rec.status, marked_by: staffId, marked_via: 'teacher_dashboard',
      });
    }
    saved++;
    if (rec.status === 'absent' || rec.status === 'late') absentRecords.push(rec);
  }

  // Absent/late notifications (best-effort, non-fatal)
  for (const rec of absentRecords) {
    try {
      const student = (validStudents ?? []).find(s => s.id === rec.student_id);
      if (!student?.phone_parent) continue;
      const { data: parent } = await supabaseAdmin.from('parents')
        .select('id').eq('school_id', schoolId).eq('phone', student.phone_parent).maybeSingle();
      if (!parent) continue;
      await supabaseAdmin.from('notifications').insert({
        school_id: schoolId, type: 'alert',
        title: `${student.name} marked ${rec.status} today`,
        message: `${student.name} was marked ${rec.status} on ${date}.`,
        target_count: 1, module: 'attendance', reference_id: parent.id,
        status: 'pending', channel: 'whatsapp', attempts: 0,
      });
      absentNotified++;
    } catch (e) { console.error('[attendance] notification failed (non-fatal):', e); }
  }

  return NextResponse.json({ saved, absent_notified: absentNotified, date, class: studentClass, section: section ?? null });
}

// ─── GET: list students + attendance for date ─────────────────────────────────
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireTeacherSession(req); }
  catch (e) { if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const params = req.nextUrl.searchParams;
  const studentClass = params.get('class');
  const section = params.get('section');
  const today = new Date().toISOString().slice(0, 10);
  const date = params.get('date') ?? today;

  if (!studentClass) return NextResponse.json({ error: 'class query param required' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });

  // Fetch students for class (students.class is TEXT)
  let query = supabaseAdmin.from('students').select('id, name, roll_number, section')
    .eq('school_id', schoolId).eq('class', studentClass).eq('is_active', true);
  if (section) query = query.eq('section', section);

  const { data: students, error: sErr } = await query.order('roll_number').order('name');
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Fetch attendance for these students on this date
  const studentIds = (students ?? []).map(s => s.id);
  const { data: attRows } = studentIds.length > 0
    ? await supabaseAdmin.from('attendance').select('student_id, status, created_at')
        .eq('school_id', schoolId).eq('date', date).in('student_id', studentIds)
    : { data: [] };

  const attMap = new Map((attRows ?? []).map(a => [a.student_id, a]));
  const merged = (students ?? []).map(s => ({
    id: s.id, name: s.name, roll_number: s.roll_number, section: s.section,
    status: attMap.get(s.id)?.status ?? null,
    marked_at: attMap.get(s.id)?.created_at ?? null,
  }));

  const summary = { total: merged.length, marked: 0, present: 0, absent: 0, late: 0, excused: 0 };
  for (const s of merged) {
    if (s.status) { summary.marked++; (summary as Record<string, number>)[s.status] = ((summary as Record<string, number>)[s.status] ?? 0) + 1; }
  }

  return NextResponse.json({ students: merged, date, class: studentClass, section: section ?? null, ...summary });
}
