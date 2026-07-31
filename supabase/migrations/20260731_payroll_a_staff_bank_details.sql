-- Payroll PR-A — staff bank details for salary disbursement and bank bulk-payment
-- file export (ICICI BizPay / NEFT formats, see Payroll PR-B).
--
-- Additive, nullable columns only. Adding a nullable column with no default is a
-- metadata-only change in Postgres, so this is safe to run on the live table with
-- no rewrite and no lock of consequence.
--
-- Apply to production (MCP DB writes are disabled for the agent):
--   run against project rqdnxdvuypekpmxbteju via the Supabase SQL editor or CLI.

alter table public.staff
  add column if not exists bank_account_name   text,
  add column if not exists bank_account_number text,
  add column if not exists bank_ifsc           text,
  add column if not exists bank_name           text;

comment on column public.staff.bank_account_name   is 'Salary account holder name (as printed by the bank)';
comment on column public.staff.bank_account_number is 'Salary account number — used to generate the bank bulk-payment file; mask in UI';
comment on column public.staff.bank_ifsc           is 'IFSC of the salary account (11 chars, uppercased)';
comment on column public.staff.bank_name           is 'Bank name for the salary account';
