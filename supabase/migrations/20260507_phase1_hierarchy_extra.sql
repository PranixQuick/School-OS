-- Phase 1 Task 1.4 follow-up — additive columns for tables the Task 1.1
-- hierarchy migration missed but that are written by dual-write routes.
--
-- Applied to production by the reviewer. This file exists in the repo for
-- `supabase db reset` parity. Fully idempotent; safe to re-run.
--
-- Every column is nullable so existing writes that don't know about the
-- hierarchy keep working. The Task 1.6 consistency checker will surface
-- any rows that ended up with NULL institution_id / academic_year_id.

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE report_narratives
  ADD COLUMN IF NOT EXISTS institution_id   uuid REFERENCES institutions(id),
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES academic_years(id);

CREATE INDEX IF NOT EXISTS idx_inquiries_institution
  ON inquiries(institution_id);

CREATE INDEX IF NOT EXISTS idx_recordings_institution
  ON recordings(institution_id);

CREATE INDEX IF NOT EXISTS idx_report_narratives_institution
  ON report_narratives(institution_id);

CREATE INDEX IF NOT EXISTS idx_report_narratives_ay
  ON report_narratives(academic_year_id);
