-- 20260620_vg01_student_subscriptions.sql
-- VG-1 (freemium) — Student-level Vidya Grid entitlement (parent top-up).
--
-- A parent can buy a paid Vidya Grid subscription for THEIR OWN child even when
-- the school is on the free tier. Effective plan for a student = the HIGHER of
-- the school plan (institutions.feature_flags.vidya_grid_plan) and any non-
-- expired row here. Each payment is its own row (payment history); the resolver
-- treats a student as paid if ANY row is non-expired.
--
-- Additive + idempotent. RLS enabled with NO policies -> only the service role
-- (server routes) can read/write. No client-direct access.

begin;

create table if not exists public.student_vidya_grid_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null,
  school_id   uuid not null,
  plan        text not null default 'paid' check (plan in ('paid')),
  paid_until  timestamptz,            -- null = no expiry; else active only while now <= paid_until
  source      text not null default 'parent' check (source in ('parent')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_svgs_student_active
  on public.student_vidya_grid_subscriptions (student_id, paid_until desc);

alter table public.student_vidya_grid_subscriptions enable row level security;
-- Intentionally no policies: only the service role may read/write.

commit;

-- Rollback:
--   drop table if exists public.student_vidya_grid_subscriptions;
