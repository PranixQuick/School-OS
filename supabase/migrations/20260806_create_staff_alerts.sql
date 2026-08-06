-- staff_alerts
-- In-app alert feed for STAFF roles (accountant, principal, owner, admin, hod, ...).
-- Targeted by role (every user of that role in the school) or a specific user.
-- Written by workflow events (fee payment, fee change, leave approval, salary run,
-- HOD directive, results, ...) via lib/alerts.ts, and read by the notification
-- bell in components/Layout.tsx through /api/alerts.
--
-- This is the shared backbone for the 16 cross-role workflows: each workflow
-- inserts alerts here for the roles that must be notified in real time. It is
-- distinct from public.notifications, which is the OUTBOUND WhatsApp/SMS queue.
--
-- Service-role app bypasses RLS; RLS is enabled with no policy so the table is
-- locked to service_role only (same posture as the rest of the app).

create table if not exists public.staff_alerts (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null,
  target_role    text,           -- role this alert is for; null = any staff
  target_user_id uuid,           -- optional: a specific school_users.id
  type           text not null,  -- 'fee_payment' | 'fee_change' | ...
  module         text,           -- 'fees' | 'leave' | ...
  title          text not null,
  message        text not null,
  reference_id   uuid,           -- domain row this alert points at
  href           text,           -- deep link for click-through
  is_read        boolean not null default false,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_staff_alerts_school_role on public.staff_alerts (school_id, target_role, is_read);
create index if not exists idx_staff_alerts_user on public.staff_alerts (target_user_id, is_read);
create index if not exists idx_staff_alerts_created on public.staff_alerts (school_id, created_at desc);

alter table public.staff_alerts enable row level security;
