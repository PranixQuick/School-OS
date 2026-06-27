-- ============================================================================
-- G3 — Role-vocabulary reconciliation (additive, non-breaking)
-- Repo: PranixQuick/School-OS   DB: rqdnxdvuypekpmxbteju
--
-- Goal (per Payments SOT, Gate G3): collapse the four role vocabularies
--   (1) app portals, (2) public.user_role enum, (3) role_permissions.role,
--   (4) school_users.role CHECK
-- into ONE canonical capability set that the new fee/payment routes certify
-- against — WITHOUT changing any existing behaviour.
--
-- This migration does three safe things:
--   A. Backfills the 20 school_users rows whose canonical column role_v2 is NULL,
--      from the legacy text role. Only known values are mapped; anything else is
--      left untouched. Re-runnable (guarded by role_v2 IS NULL).
--   B. Adds canonical_role(text) — a pure mapping from ANY vocabulary to the
--      single canonical capability label set.
--   C. Adds can_manage_fees() — the capability the new fee routes gate on.
--
-- Nothing is dropped or renamed. Founder applies on merge (no agent applies
-- production migrations).
-- ============================================================================

begin;

-- ── A. Backfill role_v2 from legacy role (only the NULL rows) ───────────────
-- Observed legacy values on NULL-role_v2 rows: owner, principal, teacher,
-- accountant, counsellor, meo, deo, admin. All are valid user_role enum values
-- except 'admin', which maps to the enum's 'admin_staff'.
update public.school_users
set role_v2 = case role
                when 'admin' then 'admin_staff'::public.user_role
                else role::public.user_role
              end
where role_v2 is null
  and role in ('owner','principal','teacher','accountant','counsellor','meo','deo','admin');

-- ── B. Canonical mapping function (pure) ────────────────────────────────────
-- Normalises every known role string (from any of the 4 vocabularies) into one
-- canonical capability label. Used for RBAC certification of new routes.
create or replace function public.canonical_role(p_role text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_role, ''))
    when 'super_admin'        then 'super_admin'
    when 'owner'              then 'owner'
    when 'principal'          then 'principal'
    when 'dean'               then 'principal'
    when 'admin'              then 'admin'
    when 'admin_staff'        then 'admin'
    when 'registrar'          then 'admin'
    when 'reception'          then 'admin'
    when 'accountant'         then 'accountant'
    when 'teacher'            then 'teacher'
    when 'hod'                then 'teacher'
    when 'counsellor'         then 'counsellor'
    when 'librarian'          then 'staff'
    when 'hostel_admin'       then 'staff'
    when 'hostel_warden'      then 'staff'
    when 'transport_staff'    then 'staff'
    when 'placement_officer'  then 'staff'
    when 'admission_officer'  then 'staff'
    when 'exam_staff'         then 'staff'
    when 'supervisor'         then 'staff'
    when 'aww'                then 'anganwadi_worker'
    when 'meo'                then 'government'
    when 'deo'                then 'government'
    when 'parent'             then 'parent'
    when 'student'            then 'student'
    when 'vendor'             then 'vendor'
    when 'viewer'             then 'viewer'
    else 'viewer'   -- safe default: read-only
  end;
$$;

comment on function public.canonical_role(text) is
  'G3: maps any role vocabulary (enum / legacy CHECK / role_permissions / portal) to one canonical capability label.';

-- ── C. Capability helper for the new fee/payment routes ─────────────────────
-- Fee management (create / assign / adjust fees) is permitted for the canonical
-- set {super_admin, owner, principal, admin, accountant}. This mirrors exactly
-- the ALLOWED_ROLES already enforced by requireAdminSession (lib/admin-auth.ts)
-- plus its accountant fee-only scoping — now expressed once, canonically.
create or replace function public.can_manage_fees(p_role text default public.current_user_role())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.canonical_role(p_role) in ('super_admin','owner','principal','admin','accountant');
$$;

comment on function public.can_manage_fees(text) is
  'G3: TRUE when the (canonical) role may manage fees. Used to certify RBAC on new fee/payment routes.';

commit;

-- ── Verification (run after apply; expect 0 NULLs and the helper to behave) ──
-- select count(*) as remaining_null_role_v2 from public.school_users where role_v2 is null;          -- expect 0
-- select public.can_manage_fees('accountant') as accountant_ok,                                       -- t
--        public.can_manage_fees('admin')      as admin_ok,                                            -- t
--        public.can_manage_fees('teacher')    as teacher_denied;                                      -- f
