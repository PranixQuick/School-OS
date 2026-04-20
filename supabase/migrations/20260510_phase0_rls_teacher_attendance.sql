-- Phase 0 Task 0.2 — tenant-scoped RLS for teacher_attendance.
-- Teachers mark themselves in; admins may adjust.
DROP POLICY IF EXISTS service_role_teacher_att         ON teacher_attendance;
DROP POLICY IF EXISTS service_role_teacher_attendance  ON teacher_attendance;

CREATE POLICY svc_all_teacher_attendance ON teacher_attendance
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_teacher_attendance ON teacher_attendance
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_teacher_attendance ON teacher_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );

CREATE POLICY auth_update_teacher_attendance ON teacher_attendance
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );
