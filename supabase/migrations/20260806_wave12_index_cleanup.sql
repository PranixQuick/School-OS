-- Performance (Wave 12) — cleanup of this session's own tables.
-- 1. other_payments.created_by / approved_by are foreign keys without covering
--    indexes (flagged by the performance advisor). Add them.
-- 2. idx_academic_records_school_term (added in the results-publish migration) is
--    identical to the pre-existing idx_academic_records_term (both (school_id, term));
--    drop the redundant one.
-- Applied live 2026-08-06. Pre-existing advisories on other tables (unindexed FKs,
-- unused indexes, RLS-initplan) are a separate tuning backlog — most are low impact
-- because the app runs as service_role and bypasses RLS.

create index if not exists idx_other_payments_created_by  on public.other_payments (created_by);
create index if not exists idx_other_payments_approved_by on public.other_payments (approved_by);

drop index if exists public.idx_academic_records_school_term;
