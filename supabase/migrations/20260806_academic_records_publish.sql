-- academic_records: add publish tracking (workflow #10).
-- NON-BREAKING: columns are nullable and the student marks view does NOT filter
-- on them, so results that are visible today stay visible. Publishing simply
-- records the event and triggers the parent notification.

alter table public.academic_records add column if not exists published_at timestamptz;
alter table public.academic_records add column if not exists published_by uuid;

create index if not exists idx_academic_records_school_term on public.academic_records (school_id, term);
