-- Phase 0 Task 0.2 — tenant-scoped RLS for students.
DROP POLICY IF EXISTS service_role_students ON students;

CREATE POLICY svc_all_students ON students
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_students ON students
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_students ON students
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );

CREATE POLICY auth_update_students ON students
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );
