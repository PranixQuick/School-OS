-- staff_hod_scope
-- lib/session.ts issueSession() reads this table at login to build the HOD's
-- hod_scope claim: SELECT school_id, department WHERE staff_id = <school_users.id>.
-- Without it, every HOD logs in with an empty scope and requireHodSession() 403s.
-- Service-role app bypasses RLS; RLS is enabled with no public policy so the
-- table is locked to service_role only (same posture as the rest of the app).

create table if not exists public.staff_hod_scope (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null,          -- school_users.id of the HOD login row
  school_id  uuid not null,          -- schools.id in the HOD's scope
  department text not null,          -- must match departments.name
  created_at timestamptz not null default now()
);

create unique index if not exists uq_staff_hod_scope on public.staff_hod_scope (staff_id, school_id, department);
create index if not exists idx_staff_hod_scope_staff on public.staff_hod_scope (staff_id);

alter table public.staff_hod_scope enable row level security;
