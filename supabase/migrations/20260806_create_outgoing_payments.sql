-- outgoing_payments
-- Accountant-initiated outgoing payments / expense vouchers with an approval
-- chain: pending_review -> pending_owner -> approved -> paid (or rejected/cancelled).
-- Served at /api/admin/expenses (the accountant route allowlist already reserves it).
-- Each transition alerts the next role via staff_alerts (workflow #7).
--
-- Service-role app bypasses RLS; RLS enabled with no policy = service_role only.

create table if not exists public.outgoing_payments (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null,
  payee        text not null,
  amount       numeric not null check (amount > 0),
  category     text,           -- vendor | utility | maintenance | salary_advance | other
  description  text,
  reference    text,           -- invoice / bill reference
  status       text not null default 'pending_review',
  created_by   uuid,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  approved_by  uuid,
  approved_at  timestamptz,
  paid_by      uuid,
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_outgoing_payments_school_status on public.outgoing_payments (school_id, status, created_at desc);

alter table public.outgoing_payments enable row level security;
