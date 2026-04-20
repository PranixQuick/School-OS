-- Phase 0 Task 0.2 — tenant-scoped RLS for school_users.
-- User management is reserved for owner/principal/super_admin (no admin_staff).
DROP POLICY IF EXISTS service_role_school_users ON school_users;

CREATE POLICY svc_all_school_users ON school_users
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_school_users ON school_users
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_school_users ON school_users
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','super_admin')
  );

CREATE POLICY auth_update_school_users ON school_users
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','super_admin')
  );
