-- Phase 0 Task 0.2 — tenant-scoped RLS for ptm_sessions.
DROP POLICY IF EXISTS service_role_ptm           ON ptm_sessions;
DROP POLICY IF EXISTS service_role_ptm_sessions  ON ptm_sessions;

CREATE POLICY svc_all_ptm_sessions ON ptm_sessions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_ptm_sessions ON ptm_sessions
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_ptm_sessions ON ptm_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );

CREATE POLICY auth_update_ptm_sessions ON ptm_sessions
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );
