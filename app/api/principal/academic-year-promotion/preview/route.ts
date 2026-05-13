// app/api/principal/academic-year-promotion/preview/route.ts
// Item #9 — Academic Year Promotion: read-only preview.
//
// GET /api/principal/academic-year-promotion/preview?from_year_id=uuid
//
// Auth: requirePrincipalSession
// Returns promotion preview — no mutations.
//
// Academic years table uses institution_id (not school_id).
// Join chain: school_id → schools.institution_id → academic_years.institution_id
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

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requirePrincipalSession(req); }
  catch (e) {
    if (e instanceof PrincipalAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const fromYearId = req.nextUrl.searchParams.get('from_year_id');

  // Resolve institution_id for this school
  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) {
    return NextResponse.json({ error: 'School has no institution configured' }, { status: 400 });
  }
  const institutionId = school.institution_id;

  // SINGLE ACTIVE YEAR VALIDATION
  const { data: activeYears, error: ayErr } = await supabaseAdmin
    .from('academic_years').select('id, label, status, is_current')
    .eq('institution_id', institutionId).eq('status', 'active');
  if (ayErr) return NextResponse.json({ error: ayErr.message }, { status: 500 });
  if ((activeYears ?? []).length > 1) {
    return NextResponse.json({
      error: 'Multiple active academic years detected. Resolve manually before promotion.',
      active_years: activeYears,
    }, { status: 400 });
  }
  if ((activeYears ?? []).length === 0) {
    return NextResponse.json({ error: 'No active academic year found.' }, { status: 400 });
  }
  const fromYear = fromYearId
    ? (activeYears ?? []).find(y => y.id === fromYearId) ?? activeYears![0]
    : activeYears![0];

  // Draft/planned years as candidates for promotion target
  const { data: candidateYears } = await supabaseAdmin
    .from('academic_years').select('id, label, status')
    .eq('institution_id', institutionId)
    .in('status', ['draft', 'planned']);

  // Fetch classes for the school (to determine max grade + target existence)
  const { data: classes } = await supabaseAdmin
    .from('classes').select('id, grade_level, section')
    .eq('school_id', schoolId).eq('is_active', true);

  const gradeLevels = [...new Set((classes ?? []).map(c => c.grade_level))].sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
  });
  const maxGrade = gradeLevels[gradeLevels.length - 1] ?? null;

  // Helper: does a class+section combo exist in classes table?
  const classSet = new Set((classes ?? []).map(c => `${c.grade_level}:${c.section}`));

  // Fetch active students
  const { data: students } = await supabaseAdmin
    .from('students').select('id, name, class, section, graduation_status')
    .eq('school_id', schoolId).eq('is_active', true);

  const activeStudents = (students ?? []).filter(s =>
    !s.graduation_status || s.graduation_status === 'active'
  );

  // Group by class+section
  const groupMap: Record<string, {
    current_class: string; current_section: string; students: typeof activeStudents;
  }> = {};
  for (const s of activeStudents) {
    const key = `${s.class}:${s.section}`;
    if (!groupMap[key]) groupMap[key] = { current_class: s.class, current_section: s.section, students: [] };
    groupMap[key].students.push(s);
  }

  const warnings: string[] = [];
  const byClass: {
    current_class: string; current_section: string; student_count: number;
    target_class: string | null; target_section: string;
    is_graduating: boolean; class_exists_in_target: boolean;
  }[] = [];
  const unmatchedStudents: { id: string; name: string; class: string; section: string; reason: string }[] = [];
  const graduatingStudents: { id: string; name: string; class: string; section: string }[] = [];

  for (const [, grp] of Object.entries(groupMap)) {
    const currentGradeNum = parseInt(grp.current_class, 10);
    const maxGradeNum = parseInt(maxGrade ?? '0', 10);
    const isGraduating = grp.current_class === maxGrade || (
      !isNaN(currentGradeNum) && !isNaN(maxGradeNum) && currentGradeNum >= maxGradeNum
    );
    const targetClass = isGraduating ? null : (
      isNaN(currentGradeNum) ? null : String(currentGradeNum + 1)
    );
    const classExistsInTarget = targetClass !== null && classSet.has(`${targetClass}:${grp.current_section}`);

    byClass.push({
      current_class: grp.current_class,
      current_section: grp.current_section,
      student_count: grp.students.length,
      target_class: targetClass,
      target_section: grp.current_section,
      is_graduating: isGraduating,
      class_exists_in_target: classExistsInTarget,
    });

    if (isGraduating) {
      for (const s of grp.students) graduatingStudents.push({ id: s.id, name: s.name, class: s.class, section: s.section });
    } else if (!targetClass) {
      for (const s of grp.students) unmatchedStudents.push({ id: s.id, name: s.name, class: s.class, section: s.section, reason: 'no_target_class' });
      warnings.push(`No numeric target class for Grade ${grp.current_class}-${grp.current_section} — ${grp.students.length} student(s) will be unmatched`);
    } else if (!classExistsInTarget) {
      warnings.push(`Target class Grade ${targetClass}-${grp.current_section} does not exist in classes table — students will be promoted to that grade_level anyway`);
    }
  }

  if ((candidateYears ?? []).length === 0) {
    warnings.push('No draft or planned academic years found. Create a target year before executing promotion.');
  }

  const canExecute = (candidateYears ?? []).length > 0 && activeStudents.length > 0;

  return NextResponse.json({
    from_year: { id: fromYear.id, label: fromYear.label, status: fromYear.status },
    to_year_candidates: (candidateYears ?? []).map(y => ({ id: y.id, label: y.label, status: y.status })),
    student_summary: {
      total_active: activeStudents.length,
      by_class: byClass.sort((a, b) => a.current_class.localeCompare(b.current_class)),
    },
    unmatched_students: unmatchedStudents,
    graduating_students: graduatingStudents,
    warnings,
    can_execute: canExecute,
  });
}
