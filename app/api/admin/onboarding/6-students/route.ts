// app/api/admin/onboarding/6-students/route.ts
// Onboarding Step 6: Bulk student + parent import
// Fixes:
//   - Higher-ed: accepts batch_label field and resolves to batch_id
//   - Automation B6: queues parent welcome + PIN notification (non-blocking)
//   - Build fix: void async IIFE instead of .then().catch() — PromiseLike type fix
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

const BATCH_TYPES = new Set([
  'coaching', 'junior_college', 'degree_college', 'engineering',
  'polytechnic', 'mba', 'medical', 'university', 'vocational',
]);

interface StudentRow {
  student_name: string;
  class?: string;
  section?: string;
  batch_label?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const rows = (body.students as StudentRow[]) ?? [];
  if (!rows.length) return NextResponse.json({ error: 'students array required' }, { status: 400 });

  const { data: schoolRow } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const institutionId = schoolRow?.institution_id ?? null;

  let institutionType = 'school_k10';
  if (institutionId) {
    const { data: inst } = await supabaseAdmin
      .from('institutions').select('institution_type').eq('id', institutionId).maybeSingle();
    if (inst?.institution_type) institutionType = inst.institution_type;
  }

  const usesBatches = BATCH_TYPES.has(institutionType);

  const batchMap = new Map<string, string>();
  if (usesBatches && institutionId) {
    const { data: batches } = await supabaseAdmin
      .from('batches').select('id, label').eq('institution_id', institutionId);
    for (const b of batches ?? []) batchMap.set(b.label.toLowerCase().trim(), b.id);
  }

  let studentsCreated = 0, parentsCreated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.student_name?.trim()) { errors.push('Row missing student_name'); continue; }

    if (!usesBatches && !row.class?.trim()) {
      errors.push(`Row missing class for ${row.student_name}`);
      continue;
    }

    const parentPhone = row.parent_phone?.trim() || null;

    const studentData: Record<string, unknown> = {
      school_id: schoolId,
      institution_id: institutionId,
      name: row.student_name.trim(),
      is_active: true,
      phone_parent: parentPhone,
    };

    if (usesBatches) {
      const batchLabel = (row.batch_label ?? '').toLowerCase().trim();
      const batchId = batchMap.get(batchLabel) ?? null;
      if (batchId) studentData.batch_id = batchId;
      studentData.class = row.batch_label?.trim() ?? 'General';
      studentData.section = 'A';
    } else {
      studentData.class = row.class!.trim();
      studentData.section = (row.section ?? 'A').trim().toUpperCase();
    }

    const { data: student, error: sErr } = await supabaseAdmin
      .from('students').insert(studentData).select('id').single();

    if (sErr) { errors.push(`Student insert failed (${row.student_name}): ${sErr.message}`); continue; }
    studentsCreated++;

    if (parentPhone || row.parent_name?.trim()) {
      try {
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        const { data: parentRow, error: pErr } = await supabaseAdmin
          .from('parents').upsert(
            {
              school_id: schoolId,
              student_id: student.id,
              name: (row.parent_name ?? '').trim() || 'Parent',
              phone: parentPhone,
              email: row.parent_email?.trim() || null,
              access_pin: pin,
            },
            { onConflict: 'school_id,phone', ignoreDuplicates: true }
          ).select('id, phone, name, access_pin').maybeSingle();

        if (!pErr) {
          parentsCreated++;

          // Automation B6: fire-and-forget parent welcome notification
          // void async IIFE — supabaseAdmin returns PromiseLike, not native Promise
          if (parentRow?.phone) {
            const notifName = parentRow.name;
            const notifStudentName = row.student_name.trim();
            const notifPin = parentRow.access_pin ?? pin;
            void (async () => {
              try {
                await supabaseAdmin.from('notifications').insert({
                  school_id: schoolId,
                  type: 'parent_welcome',
                  title: 'Parent Portal Access',
                  message: `Hello ${notifName}, your child ${notifStudentName} has been enrolled. Your parent portal PIN is: ${notifPin}. Login at edprosys.com/parent`,
                  module: 'onboarding',
                  status: 'pending',
                  channel: 'whatsapp',
                  template_vars: {
                    parent_name: notifName,
                    student_name: notifStudentName,
                    pin: notifPin,
                    portal_url: 'https://www.edprosys.com/parent',
                  },
                });
              } catch { /* non-blocking */ }
            })();
          }
        } else {
          errors.push(`Parent upsert (${row.student_name}): ${pErr.message}`);
        }
      } catch (e) {
        console.error('[onboarding/6-students] parent upsert failed (non-fatal):', e);
      }
    }
  }

  return NextResponse.json({
    success: true,
    step: 6,
    students_created: studentsCreated,
    parents_created: parentsCreated,
    errors,
    institution_type: institutionType,
    uses_batches: usesBatches,
  });
}
