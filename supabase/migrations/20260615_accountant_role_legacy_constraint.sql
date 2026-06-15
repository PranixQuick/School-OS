-- 20260615_accountant_role_legacy_constraint.sql
-- Decision 2 (founder-locked 2026-06-15): Dedicated Accountant role supported;
-- schools may choose admin-only accounting.
--
-- Context: the canonical role model (public.user_role enum on
-- school_users.role_v2) already includes 'accountant' (verified). The LEGACY
-- public.staff.role TEXT check still omitted it, which forced accountant staff to
-- run as 'admin' and was the open certification gap. This migration aligns the
-- legacy check and adds a per-school accounting mode. Additive and reversible;
-- no existing rows are modified.

BEGIN;

-- 1) Allow 'accountant' on the legacy staff.role text column.
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_role_check
  CHECK (role = ANY (ARRAY['admin', 'teacher', 'counsellor', 'principal', 'accountant']));

-- 2) Per-school accounting mode.
--    Default 'admin_only' preserves current behaviour; a school opts in to a
--    dedicated accountant by setting 'dedicated'.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS accounting_mode text NOT NULL DEFAULT 'admin_only';
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_accounting_mode_check;
ALTER TABLE public.schools ADD CONSTRAINT schools_accounting_mode_check
  CHECK (accounting_mode IN ('dedicated', 'admin_only'));

COMMIT;

-- Rollback:
--   ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_accounting_mode_check;
--   ALTER TABLE public.schools DROP COLUMN IF EXISTS accounting_mode;
--   ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
--   ALTER TABLE public.staff ADD CONSTRAINT staff_role_check
--     CHECK (role = ANY (ARRAY['admin', 'teacher', 'counsellor', 'principal']));
