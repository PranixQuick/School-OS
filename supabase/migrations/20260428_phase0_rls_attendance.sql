-- Phase 0 Task 0.2 — tenant-scoped RLS for attendance.
-- Teachers routinely mark attendance, so they are permitted on write.
DROP POLICY IF EXISTS service_role_attendance ON attendance;

CREATE POLICY svc_all_attendance ON attendance
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_attendance ON attendance
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_attendance ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );

CREATE POLICY auth_update_attendance ON attendance
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );
