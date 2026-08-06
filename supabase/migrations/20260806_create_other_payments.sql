-- other_payments
-- Backs the existing expenses feature (app/api/admin/expenses + [id]/approve).
-- The routes referenced this table but it was never created in the DB — so the
-- expenses feature would 500 at runtime. This migration creates it.
--
-- Flow: accountant logs a payment -> pending_approval -> owner/admin/principal
-- approve|reject|paid. Workflow #7 adds staff_alerts at create + decision.
-- created_by / approved_by FK to school_users(id) so the GET email embed resolves.
-- Service-role app bypasses RLS; RLS on with no policy = service_role only.

create table if not exists public.other_payments (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null,
  category          text not null,
  type              text not null,
  amount            numeric not null check (amount > 0),
  description       text,
  status            text not null default 'pending_approval',
  created_by        uuid references public.school_users(id),
  approved_by       uuid references public.school_users(id),
  approved_at       timestamptz,
  payment_reference text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_other_payments_school_status on public.other_payments (school_id, status, created_at desc);

alter table public.other_payments enable row level security;
