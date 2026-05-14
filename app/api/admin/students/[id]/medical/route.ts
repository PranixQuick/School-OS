// app/api/admin/students/[id]/medical/route.ts
// Batch 4E — Student medical profile GET and PATCH.
// GET: accessible by admin, principal, teacher (view-only for teachers).
// PATCH: admin + principal only.
// Returns medical fields + last 10 health incidents.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const MEDICAL_COLS = 'blood_group,allergies,chronic_conditions,medical_notes,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,dietary_restrictions,medical_updated_at';

async function resolveSession(req: NextRequest): Promise<{ schoolId: string; staffId: string | null; role: string }> {
  try {
    const ctx = await requireAdminSession(req);
    return { schoolId: ctx.schoolId, staffId: ctx.staffId, role: ctx.userRole };
  } catch (e) {
    if (e instanceof AdminAuthError && e.status === 403) {
      // Try teacher
      try {
        const t = await requireTeacherSession(req);
        return { schoolId: t.schoolId, staffId: t.staffId, role: 'teacher' };
      } catch {}
    }
    throw e;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await resolveSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { id } = await params;
  const { schoolId } = ctx;

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select(`id, name, class, section, ${MEDICAL_COLS}`)
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (error || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const { data: incidents } = await supabaseAdmin
    .from('health_incidents')
    .select('id, incident_date, incident_type, description, first_aid_given, referred_to_hospital, parent_notified, notified_at, staff(name)')
    .eq('school_id', schoolId).eq('student_id', id)
    .order('incident_date', { ascending: false }).limit(10);

  const incidentList = (incidents ?? []).map(i => {
    const rec = Array.isArray(i.staff) ? i.staff[0] : i.staff as { name?: string } | null;
    return { ...i, staff: undefined, recorded_by_name: rec?.name ?? '—' };
  });

  return NextResponse.json({ medical: student, incidents: incidentList });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const allowed = ['blood_group','allergies','chronic_conditions','medical_notes','emergency_contact_name','emergency_contact_phone','emergency_contact_relation','dietary_restrictions'];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  patch.medical_updated_at = new Date().toISOString();
  patch.medical_updated_by = staffId ?? null;

  const { data: updated, error } = await supabaseAdmin
    .from('students').update(patch)
    .eq('id', id).eq('school_id', schoolId)
    .select(MEDICAL_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  return NextResponse.json({ medical: updated });
}
