-- hod_directives
-- A directive an HOD sends to staff, scoped to their institution or all branches
-- of the organisation, with Principal + Owner visibility (workflow #9).
-- Recipients are notified via staff_alerts. Service-role app bypasses RLS;
-- RLS on with no policy = service_role only.

create table if not exists public.hod_directives (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null,   -- origin institution (the HOD's)
  organisation_id uuid,            -- set when scope = all_branches
  created_by      uuid,            -- HOD school_users.id
  department      text,
  scope           text not null default 'institution',  -- institution | all_branches
  title           text not null,
  body            text not null,
  priority        text not null default 'normal',        -- normal | high
  created_at      timestamptz not null default now()
);

create index if not exists idx_hod_directives_school on public.hod_directives (school_id, created_at desc);
create index if not exists idx_hod_directives_creator on public.hod_directives (created_by, created_at desc);

alter table public.hod_directives enable row level security;
