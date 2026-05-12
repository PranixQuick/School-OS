-- Item #1 Track C — Teacher Dashboard
-- Direction code: OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD
-- Master decisions: Q1 (full rebuild), Q2 (no auth.users in seed), Q3 (additive RLS),
--                   D4 (current_teacher_staff_id helper approved)
--
-- This migration does THREE things:
--   1. Creates SQL helper current_teacher_staff_id() — used by RLS policies
--   2. Adds ADDITIVE auth_read_teacher / auth_write_teacher policies on 10 teacher
--      tables. Existing school_scoped / svc_all policies are preserved. Postgres
--      OR-evaluates across policies, so this widens (not narrows) access.
--   3. Seeds business data for a test teacher account: staff row, school_user mapping
--      (with auth_user_id NULL — see post-merge action below), subject, class,
--      timetable, and a class-teacher assignment.
--
-- The migration does NOT touch auth.users at all. Test teacher login credentials
-- are NOT created here. After this PR merges, founder manually creates the
-- auth.users row through Supabase Studio (Auth → Users → Add user), then runs the
-- one-liner SQL printed in the PR description to link the new auth.users.id into
-- public.school_users.auth_user_id for the seeded row.
--
-- Deterministic IDs used by this seed:
--   school_id:     00000000-0000-0000-0000-000000000001 (existing Suchitra Academy)
--   teacher staff_id: 00000000-0000-0000-0000-000000000101
--   school_users id:  00000000-0000-0000-0000-000000000102
--   subject_id:    00000000-0000-0000-0000-000000000103
--   class_id:      00000000-0000-0000-0000-000000000104
--   timetable id1: 00000000-0000-0000-0000-000000000105
--   timetable id2: 00000000-0000-0000-0000-000000000106
--   sca_id:        00000000-0000-0000-0000-000000000107

-- ============================================================================
-- PART 1: SQL helper function used by teacher RLS policies
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_teacher_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT staff_id
  FROM public.school_users
  WHERE auth_user_id = auth.uid()
    AND role_v2 = 'teacher'
    AND is_active = true
  LIMIT 1
$$;

COMMENT ON FUNCTION public.current_teacher_staff_id() IS
  'Item #1 Track C: returns the staff_id of the calling teacher (joined via school_users.auth_user_id = auth.uid()). Returns NULL for non-teachers or unlinked accounts. SECURITY INVOKER on purpose — must run as caller so auth.uid() is correct.';

-- ============================================================================
-- PART 2: Additive auth_read_teacher / auth_write_teacher RLS policies
-- ============================================================================
-- Existing school_scoped / svc_all policies remain. These ADD a permissive
-- check that any authenticated teacher whose staff_id matches the row's
-- staff_id can SELECT (and on owned-by-teacher rows, UPDATE/INSERT).

-- timetable: teachers can read their own scheduled periods
CREATE POLICY auth_read_teacher_timetable ON public.timetable
  FOR SELECT TO authenticated
  USING (staff_id = public.current_teacher_staff_id());

-- staff_class_assignments: teachers can read their own assignments
CREATE POLICY auth_read_teacher_sca ON public.staff_class_assignments
  FOR SELECT TO authenticated
  USING (staff_id = public.current_teacher_staff_id());

-- classes: teachers can read classes they teach (via timetable or SCA)
CREATE POLICY auth_read_teacher_classes ON public.classes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.timetable t
      WHERE t.class_id = classes.id
        AND t.staff_id = public.current_teacher_staff_id()
    )
    OR class_teacher_id = public.current_teacher_staff_id()
  );

-- subjects: teachers can read all subjects in their school (broad read OK)
CREATE POLICY auth_read_teacher_subjects ON public.subjects
  FOR SELECT TO authenticated
  USING (
    public.current_teacher_staff_id() IS NOT NULL
    AND school_id = (
      SELECT school_id FROM public.school_users
      WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

-- homework: teachers can read homework they assigned, and insert new homework
CREATE POLICY auth_read_teacher_homework ON public.homework
  FOR SELECT TO authenticated
  USING (assigned_by = public.current_teacher_staff_id());
CREATE POLICY auth_write_teacher_homework ON public.homework
  FOR INSERT TO authenticated
  WITH CHECK (assigned_by = public.current_teacher_staff_id());

-- homework_submissions: teachers can read submissions for their own homework
CREATE POLICY auth_read_teacher_homework_subs ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_submissions.homework_id
        AND h.assigned_by = public.current_teacher_staff_id()
    )
  );
CREATE POLICY auth_update_teacher_homework_subs ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework h
      WHERE h.id = homework_submissions.homework_id
        AND h.assigned_by = public.current_teacher_staff_id()
    )
  );

-- lesson_plans: teachers manage their own
CREATE POLICY auth_read_teacher_lp ON public.lesson_plans
  FOR SELECT TO authenticated
  USING (staff_id = public.current_teacher_staff_id());
CREATE POLICY auth_write_teacher_lp ON public.lesson_plans
  FOR INSERT TO authenticated
  WITH CHECK (staff_id = public.current_teacher_staff_id());
CREATE POLICY auth_update_teacher_lp ON public.lesson_plans
  FOR UPDATE TO authenticated
  USING (staff_id = public.current_teacher_staff_id());

-- teacher_leave_requests: teachers submit/read their own
CREATE POLICY auth_read_teacher_leave ON public.teacher_leave_requests
  FOR SELECT TO authenticated
  USING (staff_id = public.current_teacher_staff_id());
CREATE POLICY auth_write_teacher_leave ON public.teacher_leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (staff_id = public.current_teacher_staff_id());

-- teacher_geo_pings: teachers write their own (read covered by school_scoped)
CREATE POLICY auth_write_teacher_geo ON public.teacher_geo_pings
  FOR INSERT TO authenticated
  WITH CHECK (staff_id = public.current_teacher_staff_id());

-- classroom_proofs: teachers manage their own uploads
CREATE POLICY auth_read_teacher_proofs ON public.classroom_proofs
  FOR SELECT TO authenticated
  USING (staff_id = public.current_teacher_staff_id());
CREATE POLICY auth_write_teacher_proofs ON public.classroom_proofs
  FOR INSERT TO authenticated
  WITH CHECK (staff_id = public.current_teacher_staff_id());

-- ============================================================================
-- PART 3: Seed test teacher business data (NO auth.users — see PR description)
-- ============================================================================

-- Test teacher staff row. school_id = existing demo Suchitra Academy school.
INSERT INTO public.staff (
  id, school_id, institution_id, name, role, subject, phone, email, is_active
)
SELECT
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  institution_id,
  'Test Teacher (Item #1 seed)',
  'teacher',
  'Mathematics',
  '+919999999901',
  'test.teacher@schoolos.local',
  true
FROM public.staff
WHERE school_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND institution_id IS NOT NULL
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Defensive fallback: if no existing staff row had an institution_id, find one directly.
INSERT INTO public.staff (
  id, school_id, institution_id, name, role, subject, phone, email, is_active
)
SELECT
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM public.institutions WHERE school_id = '00000000-0000-0000-0000-000000000001'::uuid LIMIT 1),
  'Test Teacher (Item #1 seed)',
  'teacher',
  'Mathematics',
  '+919999999901',
  'test.teacher@schoolos.local',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff WHERE id = '00000000-0000-0000-0000-000000000101'::uuid
);

-- school_users mapping — auth_user_id is NULL on purpose.
-- Founder fills this in post-merge via the one-liner in PR description.
INSERT INTO public.school_users (
  id, school_id, auth_user_id, email, name, role, role_v2, is_active, staff_id
)
VALUES (
  '00000000-0000-0000-0000-000000000102'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  NULL,
  'test.teacher@schoolos.local',
  'Test Teacher (Item #1 seed)',
  'teacher',
  'teacher',
  true,
  '00000000-0000-0000-0000-000000000101'::uuid
)
ON CONFLICT (id) DO NOTHING;

-- Subject (Mathematics)
INSERT INTO public.subjects (id, school_id, institution_id, code, name, board_alignment)
SELECT
  '00000000-0000-0000-0000-000000000103'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT institution_id FROM public.staff WHERE id = '00000000-0000-0000-0000-000000000101'::uuid),
  'MATH-S1',
  'Mathematics',
  'CBSE'
ON CONFLICT (id) DO NOTHING;

-- Class (Grade 8, Section A)
INSERT INTO public.classes (
  id, school_id, institution_id, academic_year_id, grade_level, section, class_teacher_id, capacity
)
SELECT
  '00000000-0000-0000-0000-000000000104'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT institution_id FROM public.staff WHERE id = '00000000-0000-0000-0000-000000000101'::uuid),
  (SELECT id FROM public.academic_years WHERE school_id = '00000000-0000-0000-0000-000000000001'::uuid LIMIT 1),
  '8',
  'A',
  '00000000-0000-0000-0000-000000000101'::uuid,
  40
ON CONFLICT (id) DO NOTHING;

-- Timetable: Monday period 1, Wednesday period 3 — gives the dashboard 2 scheduled periods
INSERT INTO public.timetable (
  id, school_id, class_id, subject_id, staff_id, day_of_week, period, start_time, end_time
)
VALUES
  ('00000000-0000-0000-0000-000000000105'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000104'::uuid,
   '00000000-0000-0000-0000-000000000103'::uuid,
   '00000000-0000-0000-0000-000000000101'::uuid,
   1, 1, '09:00:00', '09:45:00'),
  ('00000000-0000-0000-0000-000000000106'::uuid,
   '00000000-0000-0000-0000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000104'::uuid,
   '00000000-0000-0000-0000-000000000103'::uuid,
   '00000000-0000-0000-0000-000000000101'::uuid,
   3, 3, '11:00:00', '11:45:00')
ON CONFLICT (id) DO NOTHING;

-- staff_class_assignments: marks this teacher as class teacher for 8-A
INSERT INTO public.staff_class_assignments (
  id, institution_id, staff_id, academic_year_id, class, section, subjects, is_class_teacher
)
SELECT
  '00000000-0000-0000-0000-000000000107'::uuid,
  (SELECT institution_id FROM public.staff WHERE id = '00000000-0000-0000-0000-000000000101'::uuid),
  '00000000-0000-0000-0000-000000000101'::uuid,
  (SELECT id FROM public.academic_years WHERE school_id = '00000000-0000-0000-0000-000000000001'::uuid LIMIT 1),
  '8', 'A',
  ARRAY['Mathematics']::text[],
  true
ON CONFLICT (id) DO NOTHING;

-- Sanity: confirm everything seeded together
DO $$
DECLARE
  staff_count INTEGER;
  user_count INTEGER;
  tt_count INTEGER;
BEGIN
  SELECT count(*) INTO staff_count FROM public.staff WHERE id = '00000000-0000-0000-0000-000000000101'::uuid;
  SELECT count(*) INTO user_count FROM public.school_users WHERE id = '00000000-0000-0000-0000-000000000102'::uuid;
  SELECT count(*) INTO tt_count FROM public.timetable WHERE staff_id = '00000000-0000-0000-0000-000000000101'::uuid;
  IF staff_count = 0 OR user_count = 0 OR tt_count = 0 THEN
    RAISE WARNING 'Item #1 seed verification: staff=%, school_user=%, timetable_rows=%. Founder should investigate before linking auth user.', staff_count, user_count, tt_count;
  ELSE
    RAISE NOTICE 'Item #1 seed verified: staff=%, school_user=%, timetable_rows=%', staff_count, user_count, tt_count;
  END IF;
END $$;
