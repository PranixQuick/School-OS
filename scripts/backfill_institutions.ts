// scripts/backfill_institutions.ts
// Phase 1 Task 1.2 — idempotent backfill (local / CI parity with
// supabase/migrations/20260506_phase1_backfill.sql).
//
// Run:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx scripts/backfill_institutions.ts
//
// The SQL migration is authoritative for production. This script is for
// local testing, staging dry-runs, and validating idempotency.
// Running twice must produce "no changes" on the second run.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[backfill] missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DEFAULT_TERM_STRUCTURE = {
  terms: [
    { code: 'FA1', start: '2026-06-15', end: '2026-07-31' },
    { code: 'SA1', start: '2026-09-20', end: '2026-10-10' },
    { code: 'FA2', start: '2026-11-01', end: '2026-12-15' },
    { code: 'SA2', start: '2027-03-01', end: '2027-03-25' },
  ],
};

const DEFAULT_CBSE_GRADING_SCHEMA = {
  scale: 'cbse_9pt',
  grades: [
    { code: 'A1', min: 91, max: 100, gp: 10 },
    { code: 'A2', min: 81, max: 90, gp: 9 },
    { code: 'B1', min: 71, max: 80, gp: 8 },
    { code: 'B2', min: 61, max: 70, gp: 7 },
    { code: 'C1', min: 51, max: 60, gp: 6 },
    { code: 'C2', min: 41, max: 50, gp: 5 },
    { code: 'D',  min: 33, max: 40, gp: 4 },
    { code: 'E',  min: 0,  max: 32, gp: 0 },
  ],
};

interface SchoolRow {
  id: string;
  name: string | null;
  slug: string | null;
  board: string | null;
  plan: string | null;
}

interface BackfillDelta {
  orgs_inserted: number;
  institutions_inserted: number;
  academic_years_inserted: number;
  programmes_inserted: number;
  schools_linked: number;
  students_linked: number;
  staff_linked: number;
  school_users_linked: number;
  students_year_linked: number;
  schools_skipped: number;
}

async function run(): Promise<BackfillDelta> {
  const delta: BackfillDelta = {
    orgs_inserted: 0,
    institutions_inserted: 0,
    academic_years_inserted: 0,
    programmes_inserted: 0,
    schools_linked: 0,
    students_linked: 0,
    staff_linked: 0,
    school_users_linked: 0,
    students_year_linked: 0,
    schools_skipped: 0,
  };

  console.log('[backfill] starting…');

  const { data: schools, error: schoolsErr } = await supabase
    .from('schools')
    .select('id, name, slug, board, plan');

  if (schoolsErr) throw schoolsErr;
  console.log(`[backfill] ${schools!.length} school(s) found`);

  for (const school of schools as SchoolRow[]) {
    if (!school.slug || !school.name) {
      console.warn(
        `  [skip] school id=${school.id} has null slug or name — cannot backfill`
      );
      delta.schools_skipped += 1;
      continue;
    }

    // 1. Organisation — upsert by slug.
    const { data: existingOrg } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', school.slug)
      .maybeSingle();

    let orgId: string;
    if (existingOrg) {
      orgId = existingOrg.id as string;
    } else {
      const { data: newOrg, error } = await supabase
        .from('organisations')
        .insert({ name: school.name, slug: school.slug })
        .select('id')
        .single();
      if (error) throw error;
      orgId = newOrg!.id as string;
      delta.orgs_inserted += 1;
    }

    // 2. Institution — look up by legacy_school_id (1:1 with school).
    const { data: existingInst } = await supabase
      .from('institutions')
      .select('id')
      .eq('legacy_school_id', school.id)
      .maybeSingle();

    let instId: string;
    if (existingInst) {
      instId = existingInst.id as string;
    } else {
      const { data: newInst, error } = await supabase
        .from('institutions')
        .insert({
          organisation_id: orgId,
          legacy_school_id: school.id,
          name: school.name,
          slug: school.slug,
          institution_type: 'school_k10',
          board: school.board ?? 'CBSE',
          plan: school.plan ?? 'free',
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      instId = newInst!.id as string;
      delta.institutions_inserted += 1;
    }

    // 3. Academic year '2026-27' — unique (institution_id, label).
    const { data: existingYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('institution_id', instId)
      .eq('label', '2026-27')
      .maybeSingle();

    let yearId: string;
    if (existingYear) {
      yearId = existingYear.id as string;
    } else {
      const { data: newYear, error } = await supabase
        .from('academic_years')
        .insert({
          institution_id: instId,
          label: '2026-27',
          start_date: '2026-06-01',
          end_date: '2027-04-30',
          is_current: true,
          term_structure: DEFAULT_TERM_STRUCTURE,
        })
        .select('id')
        .single();
      if (error) throw error;
      yearId = newYear!.id as string;
      delta.academic_years_inserted += 1;
    }

    // 4. Default programme CBSE_K10 — unique (institution_id, code).
    const { data: existingProg } = await supabase
      .from('programmes')
      .select('id')
      .eq('institution_id', instId)
      .eq('code', 'CBSE_K10')
      .maybeSingle();

    if (!existingProg) {
      const { error } = await supabase.from('programmes').insert({
        institution_id: instId,
        code: 'CBSE_K10',
        name: 'CBSE Class 1-10',
        duration_years: 10,
        has_semesters: false,
        credit_system: false,
        grading_schema: DEFAULT_CBSE_GRADING_SCHEMA,
      });
      if (error) throw error;
      delta.programmes_inserted += 1;
    }

    // 5. Link schools.institution_id (only if null).
    const { count: schoolsLinked } = await supabase
      .from('schools')
      .update({ institution_id: instId }, { count: 'exact' })
      .eq('id', school.id)
      .is('institution_id', null);
    delta.schools_linked += schoolsLinked ?? 0;

    // 6. Link students.institution_id + students.academic_year_id.
    const { count: studentsLinked } = await supabase
      .from('students')
      .update(
        { institution_id: instId, academic_year_id: yearId },
        { count: 'exact' }
      )
      .eq('school_id', school.id)
      .is('institution_id', null);
    delta.students_linked += studentsLinked ?? 0;

    // 6b. Students that already had institution_id but need academic_year_id.
    const { count: yearOnly } = await supabase
      .from('students')
      .update({ academic_year_id: yearId }, { count: 'exact' })
      .eq('school_id', school.id)
      .eq('institution_id', instId)
      .is('academic_year_id', null);
    delta.students_year_linked += yearOnly ?? 0;

    // 7. Link staff.institution_id.
    const { count: staffLinked } = await supabase
      .from('staff')
      .update({ institution_id: instId }, { count: 'exact' })
      .eq('school_id', school.id)
      .is('institution_id', null);
    delta.staff_linked += staffLinked ?? 0;

    // 8. Link school_users.institution_id.
    const { count: usersLinked } = await supabase
      .from('school_users')
      .update({ institution_id: instId }, { count: 'exact' })
      .eq('school_id', school.id)
      .is('institution_id', null);
    delta.school_users_linked += usersLinked ?? 0;

    console.log(
      `  [ok] ${school.slug}  org=${orgId.slice(0, 8)}  inst=${instId.slice(0, 8)}  year=${yearId.slice(0, 8)}`
    );
  }

  return delta;
}

async function verify(): Promise<{
  students_null: number;
  staff_null: number;
  users_null: number;
  schools_null: number;
}> {
  const [s, sf, u, sch] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('institution_id', null),
    supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .is('institution_id', null),
    supabase
      .from('school_users')
      .select('id', { count: 'exact', head: true })
      .is('institution_id', null),
    supabase
      .from('schools')
      .select('id', { count: 'exact', head: true })
      .is('institution_id', null),
  ]);

  return {
    students_null: s.count ?? 0,
    staff_null: sf.count ?? 0,
    users_null: u.count ?? 0,
    schools_null: sch.count ?? 0,
  };
}

async function main() {
  const started = Date.now();
  const delta = await run();
  const v = await verify();

  console.log('\n[backfill] summary');
  console.log('  delta:', JSON.stringify(delta, null, 2));
  console.log('  null institution_id counts (should all be 0):');
  console.log('   ', JSON.stringify(v, null, 2));
  console.log(`  elapsed: ${Date.now() - started}ms`);

  const leftover =
    v.students_null + v.staff_null + v.users_null + v.schools_null;

  if (leftover > 0) {
    console.error(
      `[backfill] ${leftover} row(s) still have null institution_id. ` +
        `Inspect schools with null slug/name, or rows with school_id pointing at a deleted school.`
    );
    process.exit(1);
  }

  console.log('[backfill] done. all rows linked.');
}

main().catch((err) => {
  console.error('[backfill] FATAL', err);
  process.exit(1);
});
