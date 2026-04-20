-- Phase 0 Task 0.2 — tenant-scoped RLS for student_risk_flags.
-- System-generated flags (service_role writes). Authenticated roles may read;
-- admins can update acknowledgement/state.
DROP POLICY IF EXISTS service_role_risk_flags          ON student_risk_flags;
DROP POLICY IF EXISTS service_role_student_risk_flags  ON student_risk_flags;

CREATE POLICY svc_all_student_risk_flags ON student_risk_flags
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_student_risk_flags ON student_risk_flags
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_student_risk_flags ON student_risk_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );

CREATE POLICY auth_update_student_risk_flags ON student_risk_flags
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );
