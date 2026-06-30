-- SEC-W0-01 (P1-06): two public tables had RLS disabled. Enable it.
--
-- VERIFIED (rqdnxdvuypekpmxbteju, 2026-06-30):
--   * fee_receipt_counters (school_id, academic_year, last_seq, updated_at): per-school receipt
--     sequence counters. Only accessor is the backend service-role via lib/receipt.ts ->
--     supabaseAdmin.rpc('next_fee_receipt_no') (function is NOT security definer, so it runs as
--     the caller = service_role, which has BYPASSRLS). Enabling RLS with NO policy therefore
--     denies all anon/authenticated direct access (correct — this is an internal integrity table
--     used for receipt numbering) while service_role continues to bypass. No app impact.
--   * period_templates (institution_type, kind, default_name, default_minutes, ...): GLOBAL,
--     non-tenant reference data (no school_id). Enable RLS but keep it world-readable via a
--     SELECT policy (the values are non-sensitive period-structure defaults); writes are done by
--     the admin API as service_role (bypasses RLS), so no write policy is needed.

alter table public.fee_receipt_counters enable row level security;

alter table public.period_templates enable row level security;
create policy period_templates_read on public.period_templates
  for select to anon, authenticated
  using (true);
