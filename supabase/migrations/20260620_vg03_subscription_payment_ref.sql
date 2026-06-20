-- 20260620_vg03_subscription_payment_ref.sql
-- VG-3 (parent top-up) — idempotency for the subscribe-confirm step.
--
-- Adds a nullable payment_ref (the Razorpay payment id) + a partial unique index
-- so confirming the same payment twice cannot create two subscription rows.
-- Additive + idempotent.

begin;

alter table public.student_vidya_grid_subscriptions
  add column if not exists payment_ref text;

create unique index if not exists uq_svgs_payment_ref
  on public.student_vidya_grid_subscriptions (payment_ref)
  where payment_ref is not null;

commit;

-- Rollback:
--   drop index if exists uq_svgs_payment_ref;
--   alter table public.student_vidya_grid_subscriptions drop column if exists payment_ref;
