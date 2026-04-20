-- Phase 0 Task 0.2 — tenant-scoped RLS for parents.
-- Filename skips 0425 (webhook task) and 0426 (abuse task) to keep cutover dates disjoint.
DROP POLICY IF EXISTS service_role_parents ON parents;

CREATE POLICY svc_all_parents ON parents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_parents ON parents
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_parents ON parents
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );

CREATE POLICY auth_update_parents ON parents
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );
