-- 20260618_iss12_staff_employee_code.sql
-- ISS-12 Migration B: add a per-school employee code to staff.
--
-- Context: staff had no human-facing employee identifier (only a uuid id), so
-- the bulk importer could only dedupe by email. This adds an institution-scoped
-- employee_code, uniqueness enforced per school (UDISE/national codes are out of
-- scope here; this is the internal staff code).
--
-- Why this is safe:
--   * employee_code is a NEW nullable column — every existing staff row starts
--     NULL, so no existing row is modified or invalidated.
--   * The unique index is PARTIAL (WHERE employee_code IS NOT NULL), so multiple
--     NULL employee_codes are allowed within a school; only real codes must be
--     unique per (school_id, employee_code). Mirrors the admission_number and
--     apaar_id patterns.
-- Additive and reversible.
--
-- Note: Migration C (students.apaar_id) already exists in production
-- (idx_students_apaar_unique), so it is intentionally not repeated here.

BEGIN;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS employee_code text;

CREATE UNIQUE INDEX IF NOT EXISTS staff_school_employee_code_key
  ON public.staff (school_id, employee_code)
  WHERE employee_code IS NOT NULL;

COMMIT;

-- Rollback:
--   DROP INDEX IF EXISTS public.staff_school_employee_code_key;
--   ALTER TABLE public.staff DROP COLUMN IF EXISTS employee_code;
