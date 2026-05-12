-- Item #14 PR #2 — Extend notifications.type CHECK constraint.
-- Applied to prod autonomously before PR opened.
-- Adds homework_assigned and leave_status to existing valid types.

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY['broadcast','fee_reminder','ptm','alert','system','risk','homework_assigned','leave_status'])
);
