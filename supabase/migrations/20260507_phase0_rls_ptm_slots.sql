-- Phase 0 Task 0.2 — tenant-scoped RLS for ptm_slots.
-- Teachers may edit their own slot bookings; admins may manage all.
DROP POLICY IF EXISTS service_role_ptm_slots ON ptm_slots;

CREATE POLICY svc_all_ptm_slots ON ptm_slots
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_ptm_slots ON ptm_slots
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_ptm_slots ON ptm_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );

CREATE POLICY auth_update_ptm_slots ON ptm_slots
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','teacher','super_admin')
  );
