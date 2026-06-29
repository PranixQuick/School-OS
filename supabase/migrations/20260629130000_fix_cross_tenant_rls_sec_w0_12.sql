-- SEC-W0-12 (P0-04): replace always-true 'school_id IN (SELECT schools.id FROM schools)' isolation
-- (readable by anon via the public key) with school_users-membership tenant isolation.
-- service_role bypasses RLS; the app runs on service-role API (custom HS256 auth, no Supabase
-- auth.uid()), so there is no app impact. Anon now resolves to an empty set.
-- NOTE: applied to prod rqdnxdvuypekpmxbteju via MCP apply_migration on 2026-06-29 and verified
-- (post-migration no-op detector returned 0). Committed here for repo source-of-truth parity.

-- accreditation_records: two broken duplicate policies -> one correct
DROP POLICY IF EXISTS accred_school_isolation ON public.accreditation_records;
DROP POLICY IF EXISTS accreditation_school_isolation ON public.accreditation_records;
CREATE POLICY accreditation_records_tenant_isolation ON public.accreditation_records FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

-- departments: drop broken always-true dup; keep existing correct departments_school_isolation
DROP POLICY IF EXISTS dept_school_isolation ON public.departments;

DROP POLICY IF EXISTS result_school_isolation ON public.exam_results;
CREATE POLICY exam_results_tenant_isolation ON public.exam_results FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS exam_school_isolation ON public.exam_schedules;
CREATE POLICY exam_schedules_tenant_isolation ON public.exam_schedules FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS exam_schedule_school_isolation ON public.examination_schedule;
CREATE POLICY examination_schedule_tenant_isolation ON public.examination_schedule FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS faculty_school_isolation ON public.faculty_members;
CREATE POLICY faculty_members_tenant_isolation ON public.faculty_members FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS hall_ticket_school_isolation ON public.hall_tickets;
CREATE POLICY hall_tickets_tenant_isolation ON public.hall_tickets FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS hostel_incident_school_isolation ON public.hostel_incidents;
CREATE POLICY hostel_incidents_tenant_isolation ON public.hostel_incidents FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS intern_school_isolation ON public.internship_logs;
CREATE POLICY internship_logs_tenant_isolation ON public.internship_logs FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS intern_school_isolation ON public.internship_records;
CREATE POLICY internship_records_tenant_isolation ON public.internship_records FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS meo_action_school_isolation ON public.meo_action_items;
CREATE POLICY meo_action_items_tenant_isolation ON public.meo_action_items FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS night_att_school_isolation ON public.residential_night_attendance;
CREATE POLICY residential_night_attendance_tenant_isolation ON public.residential_night_attendance FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS safety_school_isolation ON public.safety_compliance_log;
CREATE POLICY safety_compliance_log_tenant_isolation ON public.safety_compliance_log FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS vacancy_school_isolation ON public.teacher_vacancies;
CREATE POLICY teacher_vacancies_tenant_isolation ON public.teacher_vacancies FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS "School device tokens access" ON public.device_tokens;
CREATE POLICY device_tokens_tenant_isolation ON public.device_tokens FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS "School test scores access" ON public.test_scores;
CREATE POLICY test_scores_tenant_isolation ON public.test_scores FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));

DROP POLICY IF EXISTS "School tests access" ON public.tests;
CREATE POLICY tests_tenant_isolation ON public.tests FOR ALL TO public
  USING (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true))
  WITH CHECK (school_id IN (SELECT su.school_id FROM school_users su WHERE su.auth_user_id = auth.uid() AND su.is_active = true));
