-- Item #10 Substitute Teacher Automation
-- Non-breaking additions.

ALTER TABLE public.substitute_assignments
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES public.teacher_leave_requests(id) ON DELETE SET NULL;

UPDATE public.substitute_assignments SET date = CURRENT_DATE WHERE date IS NULL;

DROP POLICY IF EXISTS auth_read_admin_substitutes ON public.substitute_assignments;
CREATE POLICY auth_read_admin_substitutes ON public.substitute_assignments
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.current_user_role() IN ('owner','principal','admin_staff','accountant','teacher'));

DROP POLICY IF EXISTS auth_write_admin_substitutes ON public.substitute_assignments;
CREATE POLICY auth_write_admin_substitutes ON public.substitute_assignments
  FOR INSERT TO authenticated
  WITH CHECK (school_id = public.current_school_id() AND public.current_user_role() IN ('owner','principal','admin_staff'));

DROP POLICY IF EXISTS auth_update_admin_substitutes ON public.substitute_assignments;
CREATE POLICY auth_update_admin_substitutes ON public.substitute_assignments
  FOR UPDATE TO authenticated
  USING (school_id = public.current_school_id() AND public.current_user_role() IN ('owner','principal','admin_staff'))
  WITH CHECK (school_id = public.current_school_id() AND public.current_user_role() IN ('owner','principal','admin_staff'));
