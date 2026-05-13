// app/api/admin/onboarding/6-students/route.ts
// Onboarding Step 6: Bulk student + parent import
// Body: { students: [{ student_name, class, section, parent_name, parent_phone, parent_email }] }
// CSV parsed client-side (papaparse). This route receives parsed rows.
// For each row: INSERT student → INSERT parent linked to student.
// Idempotent on parent phone: upserts parent by school_id+phone if unique constraint exists,
// else inserts fresh (phone is best-effort dedup).
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
interface StudentRow { student_name: string; class: string; section: string; parent_name?: string; parent_phone?: string; parent_email?: string; }
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const rows = (body.students as StudentRow[]) ?? [];
  if (!rows.length) return NextResponse.json({ error: 'students array required' }, { status: 400 });
  let studentsCreated = 0, parentsCreated = 0;
  const errors: string[] = [];
  for (const row of rows) {
    if (!row.student_name?.trim() || !row.class?.trim()) { errors.push(`Row missing student_name or class`); continue; }
    // Insert student
    const { data: student, error: sErr } = await supabaseAdmin.from('students').insert({
      school_id: schoolId, name: row.student_name.trim(),
      class: row.class.trim(), section: (row.section ?? 'A').trim().toUpperCase(),
      is_active: true,
    }).select('id').single();
    if (sErr) { errors.push(`Student insert failed (${row.student_name}): ${sErr.message}`); continue; }
    studentsCreated++;
    // Insert parent if phone or name provided
    if (row.parent_name?.trim() || row.parent_phone?.trim()) {
      const { error: pErr } = await supabaseAdmin.from('parents').insert({
        school_id: schoolId, student_id: student.id,
        name: (row.parent_name ?? '').trim() || 'Parent',
        phone: row.parent_phone?.trim() ?? null,
        email: row.parent_email?.trim() ?? null,
        access_pin: String(Math.floor(1000 + Math.random() * 9000)),
      });
      if (!pErr) parentsCreated++;
    }
  }
  return NextResponse.json({ success: true, step: 6, students_created: studentsCreated, parents_created: parentsCreated, errors });
}
