-- 20260618_iss03_subject_kind.sql
-- ISS-3 (P3.1a): classify subjects by period kind.
--
-- Context: #3 needs institution-specific periods (labs, sports, library,
-- assembly/break, remedial, seminars, activities) modelled alongside academic
-- subjects. The data model can already represent any period as a subject; this
-- adds the missing semantic dimension.
--
-- Safe/additive: subject_kind is NOT NULL DEFAULT 'academic', so all existing
-- rows (4 today) become 'academic' with no behavioural change. The CHECK keeps
-- values within the App. A taxonomy.

BEGIN;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS subject_kind text NOT NULL DEFAULT 'academic';

ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_subject_kind_check;
ALTER TABLE public.subjects ADD CONSTRAINT subjects_subject_kind_check
  CHECK (subject_kind IN ('academic', 'lab', 'sports', 'activity', 'seminar', 'library', 'break', 'remedial'));

COMMIT;

-- Rollback:
--   ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_subject_kind_check;
--   ALTER TABLE public.subjects DROP COLUMN IF EXISTS subject_kind;
