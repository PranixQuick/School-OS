-- EdProSys OTP build — PR1 (spec §2): shared phone OTP store.
--
-- One service for ALL stakeholders (every stakeholder table carries a phone).
-- Security/DPDP:
--   * code_hash only (bcrypt) — never store or log the raw code.
--   * expires_at (10-min TTL), attempts/max_attempts cap, consumed_at single-use.
--   * purpose CHECK constrains to activation | reset | login.
--   * RLS enabled with NO policies => only the service role can read/write
--     (same pattern as student_medical_audit). The app uses supabaseAdmin.

create table if not exists public.phone_otp (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  purpose       text not null check (purpose in ('activation', 'reset', 'login')),
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      int not null default 0,
  max_attempts  int not null default 5,
  consumed_at   timestamptz,
  school_id     uuid,
  created_at    timestamptz not null default now()
);

create index if not exists idx_phone_otp_phone_purpose
  on public.phone_otp (phone, purpose);

alter table public.phone_otp enable row level security;
-- Intentionally no policies: service-role only.
