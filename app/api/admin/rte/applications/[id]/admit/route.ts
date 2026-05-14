// app/api/admin/rte/applications/[id]/admit/route.ts
// Batch 4B — Admit a lottery-selected RTE applicant.
// Creates a student record, updates application, increments seat fill count.
// students: name (not applicant_name), phone_parent (not parent_phone).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.confirmed) return NextResponse.json({ error: 'confirmed=true required' }, { status: 400 });

  // Fetch application
  const { data: app, error: appErr } = await supabaseAdmin
    .from('rte_applications')
    .select('*')
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (appErr || !app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (app.status !== 'lottery_selected') {
    return NextResponse.json({ error: `Cannot admit: application is "${app.status}" (must be lottery_selected)` }, { status: 409 });
  }

  // Fetch seat config for entry_class
  const { data: config } = await supabaseAdmin
    .from('rte_seat_config')
    .select('entry_class, rte_seats, rte_seats_filled')
    .eq('school_id', schoolId)
    .eq('academic_year_id', app.academic_year_id)
    .maybeSingle();

  const entryClass = config?.entry_class ?? 'Class 1';
  const yearLabel = app.academic_year_id ? app.academic_year_id.slice(0, 4) : new Date().getFullYear().toString();
  const admissionNumber = `RTE-${yearLabel}-${String(app.lottery_number).padStart(3,'0')}`;

  // Create student record
  const { data: student, error: stuErr } = await supabaseAdmin
    .from('students')
    .insert({
      school_id: schoolId,
      name: app.applicant_name,
      parent_name: app.parent_name,
      phone_parent: app.parent_phone,
      class: entryClass.replace('Class ', ''),
      section: 'A',
      rte_category: app.category,
      aadhaar_number: app.aadhaar_number ?? null,
      admission_number: admissionNumber,
      is_active: true,
    })
    .select('id').single();
  if (stuErr) return NextResponse.json({ error: `Failed to create student: ${stuErr.message}` }, { status: 500 });

  // Update application
  await supabaseAdmin.from('rte_applications')
    .update({ status: 'admitted', student_id: student.id, admitted_at: new Date().toISOString() })
    .eq('id', id).eq('school_id', schoolId);

  // Increment seat fill count
  await supabaseAdmin.from('rte_seat_config')
    .update({ rte_seats_filled: (config?.rte_seats_filled ?? 0) + 1 })
    .eq('school_id', schoolId)
    .eq('academic_year_id', app.academic_year_id);

  return NextResponse.json({ student_id: student.id, admission_number: admissionNumber });
}
