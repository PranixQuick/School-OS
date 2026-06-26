-- ============================================================================
-- EdProSys Payments — PR-1 migration: immutable transaction ledger
-- SOURCE OF TRUTH: EdProSys-Payments-SOT-v1.0
-- Repo: PranixQuick/School-OS   DB: rqdnxdvuypekpmxbteju
-- STATUS: PROPOSAL — additive, non-breaking, secret-free.
--         DO NOT apply to production directly. Founder merges only.
-- Author: Lead Architect (independent verifier), 2026-06-26
-- ----------------------------------------------------------------------------
-- Principle: `fees` stays the "what is owed" record. This adds the immutable
-- "what was paid" record + split allocations + webhook idempotency. Nothing
-- existing is dropped or renamed. CHECK on fees.status is WIDENED (superset).
-- ============================================================================

begin;

-- 1) Immutable payments ledger -------------------------------------------------
create table if not exists public.payment_transactions (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null,
  institution_id     uuid,
  student_id         uuid,
  fee_id             uuid,                 -- nullable; multi-fee via payment_allocations
  gateway            text not null default 'razorpay'
                       check (gateway in ('razorpay','blackbaud_ip')),
  gateway_order_id   text,
  gateway_payment_id text,
  gateway_signature  text,
  amount_minor       bigint not null check (amount_minor >= 0),  -- paise
  currency           text not null default 'INR',
  method             text,                 -- upi | card | netbanking | wallet
  status             text not null default 'created'
                       check (status in ('created','authorized','captured','failed','refunded')),
  raw_payload        jsonb,
  idempotency_key    text,
  reverses_txn_id    uuid references public.payment_transactions(id), -- refund/reversal link
  created_at         timestamptz not null default now()
  -- NOTE: intentionally NO updated_at. This table is append-only.
);

-- one logical payment captured once
create unique index if not exists ux_paytxn_idem
  on public.payment_transactions (idempotency_key) where idempotency_key is not null;
create unique index if not exists ux_paytxn_gateway_payment
  on public.payment_transactions (gateway, gateway_payment_id) where gateway_payment_id is not null;
create index if not exists ix_paytxn_fee    on public.payment_transactions (fee_id);
create index if not exists ix_paytxn_school on public.payment_transactions (school_id);

-- 2) Split / partial allocations ----------------------------------------------
create table if not exists public.payment_allocations (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.payment_transactions(id),
  fee_id         uuid not null,
  amount_minor   bigint not null check (amount_minor > 0),
  created_at     timestamptz not null default now()
);
create index if not exists ix_payalloc_fee on public.payment_allocations (fee_id);

-- 3) Webhook idempotency at the edge ------------------------------------------
create table if not exists public.payment_webhook_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text not null,
  received_at       timestamptz not null default now(),
  processed         boolean not null default false,
  unique (provider, provider_event_id)
);

-- 4) Immutability guard: block UPDATE/DELETE on the ledger ---------------------
create or replace function public.deny_mutation_payment_transactions()
returns trigger language plpgsql as $$
begin
  raise exception 'payment_transactions is append-only: % rejected (id=%)',
    tg_op, coalesce(old.id, new.id);
end;
$$;

drop trigger if exists trg_paytxn_immutable on public.payment_transactions;
create trigger trg_paytxn_immutable
  before update or delete on public.payment_transactions
  for each row execute function public.deny_mutation_payment_transactions();

-- 5) Additive fee fields (NO existing column changed) -------------------------
-- Track partial collection in minor units (paise).
-- VERIFIED 2026-06-26 against live DB: fees_status_check already allows
--   pending | paid | overdue | waived | partial | pending_verification
-- so reconciliation reuses the existing 'partial' value and NO status-constraint
-- change is required. (Earlier 'partially_paid' draft was wrong — removed.)
alter table public.fees add column if not exists amount_paid_minor bigint not null default 0;

-- 6) RLS -----------------------------------------------------------------------
-- VERIFIED 2026-06-26 against the live fees policies. EdProSys uses helper
-- functions current_school_id() / current_user_role() / current_principal_staff_id()
-- and parent access via parents.auth_user_id = auth.uid(). We mirror that exactly.
-- Writes happen via the service role (edge functions), which BYPASSES RLS; the
-- immutability trigger still blocks UPDATE/DELETE for everyone, incl. service role.
-- So we create SELECT-only policies and intentionally NO insert/update/delete policy.
alter table public.payment_transactions enable row level security;
alter table public.payment_allocations  enable row level security;

-- staff read (same school + finance/admin roles), mirrors fees.auth_read_fees
drop policy if exists paytxn_staff_read on public.payment_transactions;
create policy paytxn_staff_read on public.payment_transactions
  for select using (
    school_id = current_school_id()
    and current_user_role() = any (array['owner','principal','accountant','admin_staff','super_admin'])
  );

-- parent read (their own child's transactions), mirrors fees.parent_children_select
drop policy if exists paytxn_parent_read on public.payment_transactions;
create policy paytxn_parent_read on public.payment_transactions
  for select using (
    student_id in (select p.student_id from public.parents p where p.auth_user_id = auth.uid())
  );

-- allocations inherit visibility from their parent transaction (nested RLS applies)
drop policy if exists payalloc_read on public.payment_allocations;
create policy payalloc_read on public.payment_allocations
  for select using (
    transaction_id in (select id from public.payment_transactions)
  );

-- No INSERT/UPDATE/DELETE policies on purpose: backend(service role) writes;
-- trigger trg_paytxn_immutable enforces append-only.

commit;

-- ============================================================================
-- VERIFY AFTER MERGE (architect, against live DB):
--   update public.payment_transactions set status='paid' where false;  -- must ERROR
--   delete from public.payment_transactions where false;               -- must ERROR
--   \d public.payment_transactions  -- confirm no updated_at, constraints present
-- ============================================================================
