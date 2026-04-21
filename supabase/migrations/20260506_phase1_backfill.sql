-- Phase 1 Task 1.2 — idempotent backfill.
--
-- Per existing school, creates:
--   1 organisation  (keyed by schools.slug)
--   1 institution   (legacy_school_id = schools.id)
--   1 academic year (label '2026-27', is_current=true)
--   1 programme     (code 'CBSE_K10' for institution_type='school_k10')
-- Then populates institution_id on schools, students, staff, school_users and
-- academic_year_id on students.
--
-- Every INSERT uses ON CONFLICT DO NOTHING on the natural key.
-- Every UPDATE guards on `IS NULL` so re-running is a net no-op.
--
-- Deliberately does NOT backfill academic_records.institution_id or
-- academic_records.academic_year_id — those are handled by Task 1.4 dual-write
-- for new rows, and Task 1.6 consistency checker surfaces any old rows that
-- still need manual mapping (old academic_records can't always be mapped to a
-- specific academic year without manual decisions).

-- ── 1. Organisations (one per school, keyed by slug) ────────────────────────
-- Defensive: skip rows with NULL slug or name; organisations.slug/name are
-- NOT NULL so we'd otherwise error. Reviewer verified both live schools have
-- slug + name populated, so the WHERE is a safety net for future rows.

INSERT INTO organisations (id, name, slug, created_at)
SELECT gen_random_uuid(), s.name, s.slug, now()
FROM schools s
WHERE s.slug IS NOT NULL
  AND s.name IS NOT NULL
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Institutions (one per school, linked to organisation via slug) ───────
-- Preserves schools.plan (so Suchitra Academy stays 'pro').
-- COALESCE on board defaults to 'CBSE' if a future school has a null board.

WITH school_with_org AS (
  SELECT s.id      AS school_id,
         o.id      AS org_id,
         s.name,
         s.slug,
         s.board,
         s.plan
  FROM schools s
  JOIN organisations o ON o.slug = s.slug
  WHERE s.slug IS NOT NULL
)
INSERT INTO institutions (
  organisation_id,
  legacy_school_id,
  name,
  slug,
  institution_type,
  board,
  plan,
  is_active
)
SELECT m.org_id,
       m.school_id,
       m.name,
       m.slug,
       'school_k10'::institution_type,
       COALESCE(m.board, 'CBSE'),
       COALESCE(m.plan,  'free'),
       true
FROM school_with_org m
ON CONFLICT (organisation_id, slug) DO NOTHING;

-- ── 3. Link schools.institution_id ─────────────────────────────────────────

UPDATE schools s
SET institution_id = i.id
FROM institutions i
WHERE i.legacy_school_id = s.id
  AND s.institution_id IS NULL;

-- ── 4. Link students.institution_id (via school) ───────────────────────────

UPDATE students st
SET institution_id = s.institution_id
FROM schools s
WHERE s.id = st.school_id
  AND st.institution_id IS NULL
  AND s.institution_id IS NOT NULL;

-- ── 5. Link staff.institution_id ───────────────────────────────────────────

UPDATE staff sf
SET institution_id = s.institution_id
FROM schools s
WHERE s.id = sf.school_id
  AND sf.institution_id IS NULL
  AND s.institution_id IS NOT NULL;

-- ── 6. Link school_users.institution_id ────────────────────────────────────

UPDATE school_users u
SET institution_id = s.institution_id
FROM schools s
WHERE s.id = u.school_id
  AND u.institution_id IS NULL
  AND s.institution_id IS NOT NULL;

-- ── 7. Default academic year per institution (label '2026-27') ─────────────
-- 4-term CBSE structure per PHASE_1_codex.md §1.2.

INSERT INTO academic_years (
  institution_id, label, start_date, end_date, is_current, term_structure
)
SELECT i.id,
       '2026-27',
       '2026-06-01'::date,
       '2027-04-30'::date,
       true,
       '{"terms":[
         {"code":"FA1","start":"2026-06-15","end":"2026-07-31"},
         {"code":"SA1","start":"2026-09-20","end":"2026-10-10"},
         {"code":"FA2","start":"2026-11-01","end":"2026-12-15"},
         {"code":"SA2","start":"2027-03-01","end":"2027-03-25"}
       ]}'::jsonb
FROM institutions i
ON CONFLICT (institution_id, label) DO NOTHING;

-- ── 8. Default programme per institution (CBSE 9-point grading) ────────────
-- Only for institution_type='school_k10' (the Phase 1 backfill target).
-- Other institution types get their own programmes on-demand via v2 APIs.

INSERT INTO programmes (
  institution_id, code, name, duration_years,
  has_semesters, credit_system, grading_schema
)
SELECT i.id,
       'CBSE_K10',
       'CBSE Class 1-10',
       10.0,
       false,
       false,
       '{"scale":"cbse_9pt","grades":[
         {"code":"A1","min":91,"max":100,"gp":10},
         {"code":"A2","min":81,"max":90, "gp":9},
         {"code":"B1","min":71,"max":80, "gp":8},
         {"code":"B2","min":61,"max":70, "gp":7},
         {"code":"C1","min":51,"max":60, "gp":6},
         {"code":"C2","min":41,"max":50, "gp":5},
         {"code":"D", "min":33,"max":40, "gp":4},
         {"code":"E", "min":0, "max":32, "gp":0}
       ]}'::jsonb
FROM institutions i
WHERE i.institution_type = 'school_k10'
ON CONFLICT (institution_id, code) DO NOTHING;

-- ── 9. Populate students.academic_year_id (current year only) ──────────────
-- Runs after step 4 so students.institution_id is populated; then picks the
-- is_current=true row per institution (unique partial index guarantees at
-- most one).

UPDATE students s
SET academic_year_id = ay.id
FROM academic_years ay
WHERE ay.institution_id = s.institution_id
  AND ay.is_current = true
  AND s.institution_id IS NOT NULL
  AND s.academic_year_id IS NULL;
