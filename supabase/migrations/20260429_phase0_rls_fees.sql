-- Phase 0 Task 0.2 — tenant-scoped RLS for fees.
DROP POLICY IF EXISTS service_role_fees ON fees;

CREATE POLICY svc_all_fees ON fees
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_fees ON fees
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_fees ON fees
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );

CREATE POLICY auth_update_fees ON fees
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );
