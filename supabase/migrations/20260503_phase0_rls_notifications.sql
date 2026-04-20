-- Phase 0 Task 0.2 — tenant-scoped RLS for notifications.
DROP POLICY IF EXISTS service_role_notifications ON notifications;

CREATE POLICY svc_all_notifications ON notifications
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_notifications ON notifications
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_notifications ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );

CREATE POLICY auth_update_notifications ON notifications
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );
