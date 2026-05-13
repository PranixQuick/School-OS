-- Item #9 Academic Year Promotion — schema additions.
-- Applied to prod autonomously.
-- academic_years uses institution_id; students.academic_year_id already existed.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS graduation_status TEXT DEFAULT 'active'
    CHECK (graduation_status IN ('active','graduated')),
  ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ;

ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
    CHECK (status IN ('active','completed','draft','planned')),
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promoted_by UUID;

UPDATE public.academic_years
  SET status = CASE WHEN is_current = true THEN 'active' ELSE 'completed' END
  WHERE status = 'draft' OR status IS NULL;

-- Demo: seed 2027-28 draft year for Suchitra Academy institution
INSERT INTO public.academic_years (id, institution_id, label, start_date, end_date, is_current, status, term_structure)
VALUES ('00000000-0000-0000-0000-000000000201'::uuid, 'afd2433e-bb1e-444c-9c03-cf62e84700c8'::uuid,
  '2027-28', '2027-06-01'::date, '2028-04-30'::date, false, 'draft', '{"terms":1}'::jsonb)
ON CONFLICT (id) DO NOTHING;
