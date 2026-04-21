-- Phase 1 Task 1.7 — student lifecycle events table
-- Tracks student status transitions through the school journey.
-- Additive only. No changes to existing tables.

CREATE TABLE IF NOT EXISTS student_lifecycle_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id       uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  institution_id  uuid REFERENCES institutions(id),
  academic_year_id uuid REFERENCES academic_years(id),
  from_status     text,
  to_status       text NOT NULL,
  triggered_by    uuid REFERENCES school_users(id),
  notes           text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz DEFAULT now()
);

-- Valid status values (enforced at application layer, not DB constraint —
-- allows forward-compatibility without migrations):
-- enquired | admitted | active | promoted | graduated | dropped_out | transferred

ALTER TABLE student_lifecycle_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS svc_all_student_lifecycle ON student_lifecycle_events;
CREATE POLICY svc_all_student_lifecycle
  ON student_lifecycle_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lifecycle_student
  ON student_lifecycle_events(student_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_school
  ON student_lifecycle_events(school_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_institution
  ON student_lifecycle_events(institution_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_created
  ON student_lifecycle_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_to_status
  ON student_lifecycle_events(to_status);

-- current_status helper: last event per student
CREATE OR REPLACE VIEW student_current_status AS
SELECT DISTINCT ON (student_id)
  student_id,
  to_status AS current_status,
  academic_year_id,
  institution_id,
  created_at AS status_since
FROM student_lifecycle_events
ORDER BY student_id, created_at DESC;
