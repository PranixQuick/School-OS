-- Phase 0 Task 0.2 — tenant-scoped RLS for academic_records.
-- Teachers enter marks, so they are permitted on write.
DROP POLICY IF EXISTS service_role_academic           ON academic_records;
DROP POLICY IF EXISTS service_role_academic_records   ON academic_records;

CREATE POLICY svc_all_academic_records ON academic_records
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_academic_records ON academic_records
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_academic_records ON academic_records
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );

CREATE POLICY auth_update_academic_records ON academic_records
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );
