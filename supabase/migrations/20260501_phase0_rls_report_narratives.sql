-- Phase 0 Task 0.2 — tenant-scoped RLS for report_narratives.
DROP POLICY IF EXISTS service_role_narratives          ON report_narratives;
DROP POLICY IF EXISTS service_role_report_narratives   ON report_narratives;

CREATE POLICY svc_all_report_narratives ON report_narratives
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_report_narratives ON report_narratives
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_report_narratives ON report_narratives
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );

CREATE POLICY auth_update_report_narratives ON report_narratives
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );
