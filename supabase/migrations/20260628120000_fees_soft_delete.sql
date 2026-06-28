-- Item: amend/delete fee with mandatory reason + audit trail.
-- Adds soft-delete (cancellation) support to fees so a mistakenly-created fee can be
-- removed from active views while staying recoverable + auditable (audit_log keeps old_data).
alter table public.fees
  add column if not exists is_deleted    boolean not null default false,
  add column if not exists deleted_at    timestamptz,
  add column if not exists deleted_by    uuid,
  add column if not exists delete_reason text;

-- Be explicit for any pre-existing rows.
update public.fees set is_deleted = false where is_deleted is null;

-- Fast path for the common "active fees for a school" read.
create index if not exists idx_fees_school_active on public.fees (school_id) where is_deleted = false;
