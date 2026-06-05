-- Phase D Migration: Branding Framework + Fee Template FK + Parent Auth User
-- Ticket: Phase D Closed Pilot Readiness
-- Date: 2026-06-05
-- Safe: all additive (ADD COLUMN IF NOT EXISTS), no drops, no rewrites

-- ─────────────────────────────────────────────
-- 1. BRANDING COLUMNS ON schools
-- ─────────────────────────────────────────────
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS seal_url         TEXT,
  ADD COLUMN IF NOT EXISTS signature_url    TEXT,
  ADD COLUMN IF NOT EXISTS primary_color    VARCHAR(7),
  ADD COLUMN IF NOT EXISTS secondary_color  VARCHAR(7),
  ADD COLUMN IF NOT EXISTS font_family      TEXT,
  ADD COLUMN IF NOT EXISTS tagline          TEXT,
  ADD COLUMN IF NOT EXISTS website          TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS contact_email    TEXT;

COMMENT ON COLUMN schools.seal_url         IS 'Storage path or public URL for school seal image';
COMMENT ON COLUMN schools.signature_url    IS 'Storage path or public URL for principal/registrar signature';
COMMENT ON COLUMN schools.primary_color    IS 'Brand primary hex color e.g. #1A5276';
COMMENT ON COLUMN schools.secondary_color  IS 'Brand secondary hex color';
COMMENT ON COLUMN schools.font_family      IS 'Font family name for PDF rendering';
COMMENT ON COLUMN schools.tagline          IS 'Institution tagline shown on documents';
COMMENT ON COLUMN schools.website          IS 'Institution website URL';
COMMENT ON COLUMN schools.contact_phone    IS 'Primary contact phone for documents';
COMMENT ON COLUMN schools.contact_email    IS 'Primary contact email for documents';

-- ─────────────────────────────────────────────
-- 2. FEE TEMPLATE FK on fees
-- ─────────────────────────────────────────────
ALTER TABLE fees
  ADD COLUMN IF NOT EXISTS template_id UUID
    REFERENCES fee_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN fees.template_id IS 'FK to fee_templates; set when fee row was bulk-generated from a template';

-- ─────────────────────────────────────────────
-- 3. PARENT AUTH USER ID
-- ─────────────────────────────────────────────
ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS auth_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS parents_auth_user_id_idx ON parents(auth_user_id);

COMMENT ON COLUMN parents.auth_user_id IS 'Links to auth.users for Supabase Auth login; NULL until parent activates account';

-- ─────────────────────────────────────────────
-- 4. MULTI-CHILD RLS: parent can see all children at same school
-- ─────────────────────────────────────────────
-- Drop old single-child policy if it exists, replace with multi-child
DROP POLICY IF EXISTS "parents_own_record" ON parents;
DROP POLICY IF EXISTS "parent_own_row"     ON parents;

CREATE POLICY "parent_see_own_linked_record" ON parents
  FOR SELECT USING (
    auth_user_id = auth.uid()
  );

-- Allow parent to see all their children's students rows
-- (parents -> parent_students -> students)
DROP POLICY IF EXISTS "parent_children_select" ON students;

CREATE POLICY "parent_children_select" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_students ps
      JOIN parents p ON p.id = ps.parent_id
      WHERE ps.student_id = students.id
        AND p.auth_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 5. RECORD IN SCHEMA MIGRATION LOG
-- ─────────────────────────────────────────────
INSERT INTO schema_migration_log (migration_name, description, applied_by)
VALUES (
  '20260605_phase_d_branding_fee_templates_parent_auth',
  'Phase D: 9 branding cols on schools, template_id FK on fees, auth_user_id on parents, multi-child RLS',
  'pranix-agent'
)
ON CONFLICT DO NOTHING;
