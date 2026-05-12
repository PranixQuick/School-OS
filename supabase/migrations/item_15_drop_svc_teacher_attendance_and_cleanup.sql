-- Item #15 Service Role Hardening — PR #2
-- Applied to prod autonomously by Spawn 3 after step_2 shadow simulation passed.
-- See system_state.spawn_3_thread_state.next_item.step_3_5_shadow_simulation_pr2 for details.
--
-- PRIORITY: svc_all_teacher_attendance was the MISSED HIGH-PRIORITY target from PR #1.
-- teacher_attendance is an ACTIVE table (21 rows, live check-in writes).
--
-- SHADOW SIMULATION RESULTS (all PASS, no route patches needed):
--   teacher/checkin: .eq(staff_id).eq(school_id) on SELECT; school_id in INSERT payload
--   principal/dashboard: .eq(school_id) on teacher_attendance SELECT
--   principal/teacher-presence: does NOT query teacher_attendance
--   attendance: seed data only (10 rows, no active writes)
--   staff_class_assignments: read-only (3 rows, no write flow)
--
-- Service role bypasses RLS regardless — these policies were redundant.

DROP POLICY IF EXISTS svc_all_teacher_attendance ON public.teacher_attendance;
DROP POLICY IF EXISTS svc_all_attendance ON public.attendance;
DROP POLICY IF EXISTS svc_all_sca ON public.staff_class_assignments;
