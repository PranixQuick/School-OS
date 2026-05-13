// app/api/admin/onboarding/6-students/route.ts
// Onboarding Step 6: Bulk student + parent import
// Body: { students: [{ student_name, class, section, parent_name, parent_phone, parent_email }] }
// PATCH (batch1): parent INSERT → upsert(onConflict:'school_id,phone') + phone_parent on student row
// CSV parsed client-side (papaparse). This route receives parsed rows.
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
    const parentPhone = row.parent_phone?.trim() || null;
    // Insert student (include phone_parent for attendance notification lookup)
    const { data: student, error: sErr } = await supabaseAdmin.from('students').insert({
      school_id: schoolId, name: row.student_name.trim(),
      class: row.class.trim(), section: (row.section ?? 'A').trim().toUpperCase(),
      phone_parent: parentPhone,
      is_active: true,
    }).select('id').single();
    if (sErr) { errors.push(`Student insert failed (${row.student_name}): ${sErr.message}`); continue; }
    studentsCreated++;
    // Upsert parent — idempotent on (school_id, phone) for re-imports
    if (parentPhone || row.parent_name?.trim()) {
      try {
        const { error: pErr } = await supabaseAdmin.from('parents').upsert(
          {
            school_id: schoolId, student_id: student.id,
            name: (row.parent_name ?? '').trim() || 'Parent',
            phone: parentPhone,
            email: row.parent_email?.trim() || null,
            access_pin: String(Math.floor(1000 + Math.random() * 9000)),
          },
          // onConflict: parents_school_id_phone_key — idempotent for re-imports
          // ignoreDuplicates: do NOT overwrite existing parent record if phone already registered
          { onConflict: 'school_id,phone', ignoreDuplicates: true }
        );
        if (!pErr) parentsCreated++;
        else errors.push(`Parent upsert (${row.student_name}): ${pErr.message}`);
      } catch (e) {
        console.error('[onboarding/6-students] parent upsert failed (non-fatal):', e);
        // Do NOT throw — student import must succeed regardless
      }
    }
  }
  return NextResponse.json({ success: true, step: 6, students_created: studentsCreated, parents_created: parentsCreated, errors });
}
