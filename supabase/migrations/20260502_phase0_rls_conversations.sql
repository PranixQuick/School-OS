-- Phase 0 Task 0.2 — tenant-scoped RLS for conversations.
-- Inbound/outbound WhatsApp logs — cron + webhook writes via service_role;
-- authenticated reads for admins/teachers.
DROP POLICY IF EXISTS service_role_conversations ON conversations;

CREATE POLICY svc_all_conversations ON conversations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY auth_read_conversations ON conversations
  FOR SELECT TO authenticated
  USING (school_id = current_school_id());

CREATE POLICY auth_write_conversations ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );

CREATE POLICY auth_update_conversations ON conversations
  FOR UPDATE TO authenticated
  USING (school_id = current_school_id())
  WITH CHECK (
    school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','admin_staff','super_admin')
  );
