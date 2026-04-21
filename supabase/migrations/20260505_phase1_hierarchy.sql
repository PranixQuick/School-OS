-- Phase 1 Task 1.1 — data model hierarchy (additive only).
--
-- Adds: organisations -> institutions -> academic_years -> programmes -> batches.
-- Extends: schools, students, staff, school_users, academic_records with
--          nullable institution_id / academic_year_id / batch_id / exam_type /
--          credit / grade_points columns.
--
-- Every existing row keeps working (legacy columns untouched, new columns
-- nullable, no constraints enforced yet).
-- Rollback: DROP TABLE / ALTER TABLE ... DROP COLUMN in reverse order.

-- ── Organisations (top of hierarchy) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organisations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  owner_email   text,
  billing_email text,
  gst_number    text,
  address       text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

-- ── institution_type enum ──────────────────────────────────────────────────
-- Guarded so the CREATE TYPE is idempotent across reruns.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'institution_type') THEN
    CREATE TYPE institution_type AS ENUM (
      'school_k10',
      'school_k12',
      'junior_college',
      'degree_college',
      'engineering',
      'mba',
      'medical',
      'vocational',
      'coaching'
    );
  END IF;
END$$;

-- ── Institutions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  parent_institution_id uuid REFERENCES institutions(id),
  legacy_school_id      uuid REFERENCES schools(id),
  name                  text NOT NULL,
  slug                  text NOT NULL,
  institution_type      institution_type NOT NULL DEFAULT 'school_k10',
  board                 text,
  affiliation_body      text,
  address               text,
  contact_email         text,
  contact_phone         text,
  plan                  text DEFAULT 'free',
  is_active             boolean DEFAULT true,
  settings              jsonb DEFAULT '{}'::jsonb,
  feature_flags         jsonb DEFAULT '{}'::jsonb,
  onboarded_at          timestamptz DEFAULT now(),
  UNIQUE (organisation_id, slug)
);

-- ── Academic years ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS academic_years (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  label           text NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  is_current      boolean DEFAULT false,
  term_structure  jsonb NOT NULL,
  UNIQUE (institution_id, label)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_current_year_per_inst
  ON academic_years(institution_id) WHERE is_current;

-- ── Programmes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programmes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  duration_years  numeric(3,1),
  has_semesters   boolean DEFAULT false,
  credit_system   boolean DEFAULT false,
  grading_schema  jsonb NOT NULL,
  UNIQUE (institution_id, code)
);

-- ── Batches ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  programme_id      uuid REFERENCES programmes(id),
  academic_year_id  uuid REFERENCES academic_years(id),
  label             text NOT NULL,
  entry_year        int,
  current_level     text,
  UNIQUE (institution_id, programme_id, label)
);

-- ── Additive columns on existing tables (ALL NULLABLE) ──────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS institution_id   uuid REFERENCES institutions(id),
  ADD COLUMN IF NOT EXISTS batch_id         uuid REFERENCES batches(id),
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES academic_years(id);

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE school_users
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);

ALTER TABLE academic_records
  ADD COLUMN IF NOT EXISTS institution_id   uuid REFERENCES institutions(id),
  ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES academic_years(id),
  ADD COLUMN IF NOT EXISTS exam_type        text,
  ADD COLUMN IF NOT EXISTS credit           numeric(3,1),
  ADD COLUMN IF NOT EXISTS grade_points     numeric(4,2);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_institutions_org       ON institutions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_institutions_parent    ON institutions(parent_institution_id);
CREATE INDEX IF NOT EXISTS idx_institutions_legacy    ON institutions(legacy_school_id);

CREATE INDEX IF NOT EXISTS idx_students_institution   ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_batch         ON students(batch_id);
CREATE INDEX IF NOT EXISTS idx_students_ay            ON students(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_staff_institution      ON staff(institution_id);
CREATE INDEX IF NOT EXISTS idx_school_users_inst      ON school_users(institution_id);

CREATE INDEX IF NOT EXISTS idx_academic_records_inst  ON academic_records(institution_id);
CREATE INDEX IF NOT EXISTS idx_academic_records_ay    ON academic_records(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_academic_years_inst    ON academic_years(institution_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_programmes_inst        ON programmes(institution_id);
CREATE INDEX IF NOT EXISTS idx_batches_inst           ON batches(institution_id);
CREATE INDEX IF NOT EXISTS idx_batches_programme      ON batches(programme_id);

-- ── RLS scaffolding for the new tables ──────────────────────────────────────
-- Service-role bypass only for now. Tenant-scoped policies land in a later
-- phase once every new table has real institution_id traffic and we know
-- which roles need read/write. Keeping RLS ENABLED from day one so we don't
-- need a separate "enable RLS" migration later (which would be a public-read
-- window if forgotten).

ALTER TABLE organisations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years              ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches                     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS svc_all_organisations   ON organisations;
DROP POLICY IF EXISTS svc_all_institutions    ON institutions;
DROP POLICY IF EXISTS svc_all_academic_years  ON academic_years;
DROP POLICY IF EXISTS svc_all_programmes      ON programmes;
DROP POLICY IF EXISTS svc_all_batches         ON batches;

CREATE POLICY svc_all_organisations   ON organisations  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all_institutions    ON institutions   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all_academic_years  ON academic_years FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all_programmes      ON programmes     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY svc_all_batches         ON batches        FOR ALL TO service_role USING (true) WITH CHECK (true);
