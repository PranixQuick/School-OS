-- Phase 0 Task 0.2 — tenant-scoped RLS for events.
DROP POLICY IF EXISTS service_role_events ON events;

CREATE POLICY svc_all_events ON events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_events ON events
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_events ON events
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );

CREATE POLICY auth_update_events ON events
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );
