-- 20260618_iss12_admission_number_per_school_unique.sql
-- ISS-12 Migration A: scope student admission_number uniqueness to per-school.
--
-- Context: students.admission_number carried a GLOBAL unique constraint
-- (students_admission_number_key = UNIQUE (admission_number)). That forbids two
-- different schools from ever using the same admission number, which breaks
-- multi-tenant CSV onboarding (#12). This migration replaces the global
-- constraint with a PER-SCHOOL partial unique index on
-- (school_id, admission_number).
--
-- Why this is safe (verified against production 2026-06-18):
--   * 0 global duplicate admission_numbers AND 0 (school_id, admission_number)
--     duplicates exist today, so every current row (388 total, 65 with an
--     admission number) satisfies the new index.
--   * Relaxing a global unique to a per-school composite cannot invalidate any
--     existing row (global uniqueness implies per-school uniqueness).
--   * NULL admission_numbers (323 rows) stay unconstrained — the partial index
--     only covers non-null values, and NULLs are distinct regardless.
--   * Non-breaking at the app layer: app/api/student/login already handles
--     multiple schools sharing an admission number (returns 409 asking for
--     school_id) rather than assuming a single global match.
-- Additive and reversible; no existing rows are modified.

BEGIN;

-- 1) Drop the global uniqueness on admission_number.
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_admission_number_key;

-- 2) Enforce uniqueness per school instead. Partial index so multiple rows
--    with a NULL admission_number remain allowed within a school.
CREATE UNIQUE INDEX IF NOT EXISTS students_school_admission_number_key
  ON public.students (school_id, admission_number)
  WHERE admission_number IS NOT NULL;

COMMIT;

-- Rollback:
--   DROP INDEX IF EXISTS public.students_school_admission_number_key;
--   ALTER TABLE public.students
--     ADD CONSTRAINT students_admission_number_key UNIQUE (admission_number);
--   (Rollback only succeeds while no two schools share an admission number.)
