-- ISS-11 (#11 / P4.3, App. D) — Append-only audit of medical-card changes.
--
-- Captures field-level diffs whenever a student's basic health card
-- (blood_group / allergies / medical_notes) is updated, e.g. by a parent via
-- /api/parent/health. Append-only by design:
--   * RLS is enabled with NO policies -> anon/authenticated are denied.
--   * The server writes rows using the service role (which bypasses RLS).
--   * No UPDATE/DELETE is ever issued by the app.

create table if not exists public.student_medical_audit (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null,
  student_id  uuid not null,
  parent_id   uuid,
  changed_by  text not null default 'parent',
  changes     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_student_medical_audit_student
  on public.student_medical_audit (student_id, created_at desc);

alter table public.student_medical_audit enable row level security;
-- Intentionally no policies: only the service role may read/write.
