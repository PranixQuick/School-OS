// app/api/parent/health/route.ts
// ISS-11 (#11 / P4.3) — Parent health screen.
//
// GET  -> child's basic health card (+ growth/immunization/nutrition for
//         government / anganwadi institutions, read-only).
// PATCH -> parent updates the basic card for THEIR OWN child only (the parent
//         session is bound to a single student_id). Requires explicit consent;
//         stamps medical_updated_at and appends a consent/audit row to
//         parent_consent_log.
//
// DPDP notes:
//   * Own-child only: enforced via the parent session's student_id.
//   * Append-only audit: every parent edit writes a parent_consent_log row
//     (who / when / IP / UA). We do NOT touch students.medical_updated_by —
//     that column is a FK to staff(id); parent attribution lives in the log.
//   * No new columns, no plaintext identifiers added.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

export const runtime = 'nodejs';

// Institutions that expose growth / immunization / nutrition to parents.
const GOVT_TYPES = new Set(['govt_school', 'govt_aided_school', 'welfare_school', 'anganwadi']);
const BLOOD_GROUPS = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']);

async function resolveInstitution(schoolId: string): Promise<{ type: string; ownership: string; showRecords: boolean }> {
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  let type = 'school_k12';
  let ownership = 'private';
  if (school?.institution_id) {
    const { data: inst } = await supabaseAdmin
      .from('institutions')
      .select('institution_type, ownership_type')
      .eq('id', school.institution_id)
      .maybeSingle();
    if (inst) {
      type = (inst.institution_type as string) ?? type;
      ownership = (inst.ownership_type as string) ?? ownership;
    }
  }
  const showRecords = GOVT_TYPES.has(type) || ownership === 'government';
  return { type, ownership, showRecords };
}

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { studentId, schoolId, parentId } = session;

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('id, name, class, section, blood_group, allergies, medical_notes, medical_updated_at')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const inst = await resolveInstitution(schoolId);

  let growth: unknown[] = [];
  let immunization: unknown[] = [];
  let nutrition: unknown[] = [];
  if (inst.showRecords) {
    const [g, im, n] = await Promise.all([
      supabaseAdmin.from('child_growth_records')
        .select('recorded_date, height_cm, weight_kg, muac_cm, grade_for_age, malnutrition_cat, notes')
        .eq('student_id', studentId).eq('school_id', schoolId)
        .order('recorded_date', { ascending: false }).limit(24),
      supabaseAdmin.from('immunization_records')
        .select('vaccine_name, dose_number, scheduled_date, administered_date, status')
        .eq('student_id', studentId).eq('school_id', schoolId)
        .order('scheduled_date', { ascending: false }).limit(50),
      supabaseAdmin.from('nutrition_supplement_log')
        .select('supplement_type, quantity, unit, distribution_date')
        .eq('student_id', studentId).eq('school_id', schoolId)
        .order('distribution_date', { ascending: false }).limit(50),
    ]);
    growth = g.data ?? [];
    immunization = im.data ?? [];
    nutrition = n.data ?? [];
  }

  const { data: lastUpd } = await supabaseAdmin
    .from('parent_consent_log')
    .select('granted_at')
    .eq('parent_id', parentId)
    .eq('consent_type', 'health_update')
    .eq('status', 'granted')
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    student,
    institution_type: inst.type,
    show_records: inst.showRecords,
    growth,
    immunization,
    nutrition,
    last_parent_update: lastUpd?.granted_at ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { blood_group?: string; allergies?: string[] | string; medical_notes?: string; consent?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  if (body.consent !== true) {
    return NextResponse.json({ error: 'Consent is required to update health information.' }, { status: 400 });
  }

  const bg = (body.blood_group ?? '').trim().toUpperCase();
  if (bg && !BLOOD_GROUPS.has(bg)) {
    return NextResponse.json({ error: 'Invalid blood group.' }, { status: 400 });
  }

  const allergiesRaw = Array.isArray(body.allergies) ? body.allergies : String(body.allergies ?? '').split(',');
  const allergies = allergiesRaw.map((s) => String(s).trim()).filter(Boolean).slice(0, 30);
  const notes = String(body.medical_notes ?? '').slice(0, 2000).trim();

  // Capture prior values for the append-only audit.
  const { data: prior } = await supabaseAdmin
    .from('students')
    .select('blood_group, allergies, medical_notes')
    .eq('id', session.studentId)
    .eq('school_id', session.schoolId)
    .maybeSingle();

  // Own-child only: scope by the parent session's student_id + school_id.
  const { error: updErr } = await supabaseAdmin
    .from('students')
    .update({
      blood_group: bg || null,
      allergies,
      medical_notes: notes || null,
      medical_updated_at: new Date().toISOString(),
    })
    .eq('id', session.studentId)
    .eq('school_id', session.schoolId);

  if (updErr) {
    console.error('[parent health PATCH] update failed:', updErr.message);
    return NextResponse.json({ error: 'Could not save health information. Please try again.' }, { status: 500 });
  }

  // Append-only consent + audit record (who / when / IP / UA).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent') ?? null;
  await supabaseAdmin.from('parent_consent_log').insert({
    school_id: session.schoolId,
    parent_id: session.parentId,
    consent_type: 'health_update',
    status: 'granted',
    granted_at: new Date().toISOString(),
    source: 'parent_portal',
    ip_address: ip,
    user_agent: ua,
  });

  // Append-only field-level audit (App. D).
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if ((prior?.blood_group ?? null) !== (bg || null)) {
    changes.blood_group = { from: prior?.blood_group ?? null, to: bg || null };
  }
  if (JSON.stringify(prior?.allergies ?? []) !== JSON.stringify(allergies)) {
    changes.allergies = { from: prior?.allergies ?? [], to: allergies };
  }
  if ((prior?.medical_notes ?? null) !== (notes || null)) {
    changes.medical_notes = { from: prior?.medical_notes ?? null, to: notes || null };
  }
  if (Object.keys(changes).length > 0) {
    await supabaseAdmin.from('student_medical_audit').insert({
      school_id: session.schoolId,
      student_id: session.studentId,
      parent_id: session.parentId,
      changed_by: 'parent',
      changes,
    });
  }

  return NextResponse.json({ success: true, message: 'Health information updated.' });
}
