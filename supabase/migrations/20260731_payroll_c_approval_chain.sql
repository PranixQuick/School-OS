-- Payroll PR-C — approval chain: stage stamps + widened status set.
--
-- Additive columns (nullable) + a widened CHECK. The new status set is a strict
-- superset of the old one, so no existing row is invalidated — safe on the live
-- table. Apply to production (project rqdnxdvuypekpmxbteju) via the Supabase SQL
-- editor or CLI at merge time; the agent's direct DB-write tools are disabled.

alter table public.payroll_runs
  add column if not exists submitted_for_review_by uuid,
  add column if not exists submitted_for_review_at timestamptz,
  add column if not exists reviewed_by             uuid,
  add column if not exists reviewed_at             timestamptz,
  add column if not exists submitted_by            uuid,
  add column if not exists submitted_at            timestamptz;

alter table public.payroll_runs drop constraint if exists payroll_runs_status_check;
alter table public.payroll_runs add constraint payroll_runs_status_check
  check (status = any (array[
    'draft', 'processing', 'pending_review', 'pending_owner',
    'approved', 'submitted', 'paid', 'cancelled'
  ]));

comment on column public.payroll_runs.reviewed_by  is 'admin/principal who reviewed the run (approval chain stage 2)';
comment on column public.payroll_runs.submitted_by is 'accountant/owner who released the run to the bank (approval chain final stage)';
