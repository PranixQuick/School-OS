// app/api/principal/academic-year-promotion/execute/route.ts
// Item #9 — Academic Year Promotion: execute (mutating).
//
// POST /api/principal/academic-year-promotion/execute
//
// Auth: requirePrincipalSession
// Body: { from_year_id: uuid, to_year_id: uuid, retain_student_ids?: uuid[], confirm: true }
//
// FEE CONTINUITY: NO FEE MUTATIONS. All historical fees (paid/pending/overdue) remain
// untouched. No automatic fee regeneration or carry-forward.
//
// GRADUATION SAFETY: graduating students are soft-deactivated. DO NOT DELETE.
// Records remain for Item #11 Transfer Certificate lifecycle.
//
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

interface ExecuteBody {
  from_year_id: string;
  to_year_id: string;
  retain_student_ids?: string[];
  confirm: true;
}

function isValidBody(b: unknown): b is ExecuteBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    isUuid(o.from_year_id) && isUuid(o.to_year_id) && o.confirm === true &&
    (o.retain_student_ids === undefined || (Array.isArray(o.retain_student_ids) && o.retain_student_ids.every(isUuid)))
  );
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requirePrincipalSession(req); }
  catch (e) {
    if (e instanceof PrincipalAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, session } = ctx;
  const principalUserId = session.userId;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Body must include from_year_id (uuid), to_year_id (uuid), confirm: true. Optional: retain_student_ids (uuid[]).' },
      { status: 400 }
    );
  }

  const retainSet = new Set(body.retain_student_ids ?? []);

  // Resolve institution_id
  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) {
    return NextResponse.json({ error: 'School has no institution configured' }, { status: 400 });
  }
  const institutionId = school.institution_id;

  // ── PRE-EXECUTION GUARD A: single active year ──────────────────────────
  const { data: activeYears } = await supabaseAdmin
    .from('academic_years').select('id').eq('institution_id', institutionId).eq('status', 'active');
  if ((activeYears ?? []).length > 1) {
    return NextResponse.json(
      { error: 'Multiple active academic years detected. Resolve manually before promotion.' },
      { status: 400 }
    );
  }
  if ((activeYears ?? []).length === 0) {
    return NextResponse.json({ error: 'No active academic year found.' }, { status: 400 });
  }

  // ── PRE-EXECUTION GUARD B: verify from_year belongs to institution + is active ──
  const { data: fromYear } = await supabaseAdmin
    .from('academic_years').select('id, label, status')
    .eq('id', body.from_year_id).eq('institution_id', institutionId).maybeSingle();
  if (!fromYear) return NextResponse.json({ error: 'Source academic year not found for this institution' }, { status: 404 });
  if (fromYear.status !== 'active') return NextResponse.json({ error: `Source year status is '${fromYear.status}', expected 'active'` }, { status: 400 });

  // ── PRE-EXECUTION GUARD C: verify to_year exists, belongs to institution, not active ──
  const { data: toYear } = await supabaseAdmin
    .from('academic_years').select('id, label, status')
    .eq('id', body.to_year_id).eq('institution_id', institutionId).maybeSingle();
  if (!toYear) return NextResponse.json({ error: 'Target academic year not found for this institution' }, { status: 404 });
  if (toYear.status === 'active') return NextResponse.json({ error: 'Target year is already active. Choose a draft or planned year.' }, { status: 400 });

  // ── Fetch classes to determine max grade ──────────────────────────────────
  const { data: classes } = await supabaseAdmin
    .from('classes').select('grade_level, section')
    .eq('school_id', schoolId);
  const gradeLevels = [...new Set((classes ?? []).map(c => c.grade_level))].sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
  });
  const maxGrade = gradeLevels[gradeLevels.length - 1] ?? null;

  // ── Fetch active students ─────────────────────────────────────────────────
  const { data: students, error: sErr } = await supabaseAdmin
    .from('students').select('id, name, class, section, graduation_status')
    .eq('school_id', schoolId).eq('is_active', true);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const activeStudents = (students ?? []).filter(s =>
    !s.graduation_status || s.graduation_status === 'active'
  );

  // ── Classify students ──────────────────────────────────────────────────────
  const toPromote: string[] = [];
  const toGraduate: string[] = [];
  const toRetain: string[] = [];
  const unmatched: string[] = [];

  for (const s of activeStudents) {
    if (retainSet.has(s.id)) { toRetain.push(s.id); continue; }
    const gradeNum = parseInt(s.class, 10);
    const maxGradeNum = parseInt(maxGrade ?? '0', 10);
    const isGraduating = s.class === maxGrade || (!isNaN(gradeNum) && !isNaN(maxGradeNum) && gradeNum >= maxGradeNum);
    if (isGraduating) { toGraduate.push(s.id); continue; }
    if (isNaN(gradeNum)) { unmatched.push(s.id); continue; }
    toPromote.push(s.id);
  }

  // ── Execute in series (supabaseAdmin does not support real transactions,
  //    but we validate before each step and return errors explicitly) ───────────

  const now = new Date().toISOString();
  let promotedCount = 0;
  let graduatedCount = 0;

  // Step 1 — Promote eligible students (class + 1, same section, link to new year)
  if (toPromote.length > 0) {
    // Get current class for each student to compute target
    const { data: promoteStudents } = await supabaseAdmin
      .from('students').select('id, class, section')
      .in('id', toPromote).eq('school_id', schoolId);

    for (const s of promoteStudents ?? []) {
      const nextClass = String(parseInt(s.class, 10) + 1);
      const { error: upErr } = await supabaseAdmin
        .from('students').update({
          class: nextClass,
          academic_year_id: body.to_year_id,
          updated_at: now,
        })
        .eq('id', s.id).eq('school_id', schoolId);
      if (upErr) console.error(`[promotion] failed to promote student ${s.id}:`, upErr.message);
      else promotedCount++;
    }
  }

  // Step 2 — Graduate final-class students (soft deactivate — DO NOT DELETE)
  // Records remain for Item #11 Transfer Certificate lifecycle.
  if (toGraduate.length > 0) {
    const { error: gErr, count } = await supabaseAdmin
      .from('students').update({
        graduation_status: 'graduated',
        graduated_at: now,
        is_active: false,
        academic_year_id: body.to_year_id,
        updated_at: now,
      })
      .in('id', toGraduate).eq('school_id', schoolId);
    if (gErr) return NextResponse.json({ error: `Graduation step failed: ${gErr.message}` }, { status: 500 });
    graduatedCount = toGraduate.length;
  }

  // Step 3 — Retain students: link to new year, no class change
  if (toRetain.length > 0) {
    await supabaseAdmin.from('students').update({ academic_year_id: body.to_year_id, updated_at: now })
      .in('id', toRetain).eq('school_id', schoolId);
  }

  // Step 4 — Complete old academic year
  const { error: completeErr } = await supabaseAdmin
    .from('academic_years').update({
      status: 'completed',
      is_current: false,
      promoted_at: now,
      promoted_by: principalUserId,
    })
    .eq('id', body.from_year_id).eq('institution_id', institutionId);
  if (completeErr) return NextResponse.json({ error: `Failed to complete source year: ${completeErr.message}` }, { status: 500 });

  // Step 5 — Activate new academic year
  const { error: activateErr } = await supabaseAdmin
    .from('academic_years').update({ status: 'active', is_current: true })
    .eq('id', body.to_year_id).eq('institution_id', institutionId);
  if (activateErr) return NextResponse.json({ error: `Failed to activate target year: ${activateErr.message}` }, { status: 500 });

  // FEE CONTINUITY NOTE: fees table is NOT touched. All historical paid/pending/overdue
  // fees remain unchanged. No automatic regeneration or carry-forward.

  return NextResponse.json({
    success: true,
    promoted_count: promotedCount,
    graduated_count: graduatedCount,
    retained_count: toRetain.length,
    unmatched_count: unmatched.length,
    new_active_year: { id: toYear.id, label: toYear.label },
    message: 'Promotion completed. New academic year fee schedules must be assigned separately.',
  });
}
