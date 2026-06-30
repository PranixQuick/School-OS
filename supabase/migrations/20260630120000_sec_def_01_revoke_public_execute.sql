-- SEC-DEF-01 (P0-03): RPC-exposed SECURITY DEFINER functions carried the default PUBLIC
-- EXECUTE grant, so `anon` (unauthenticated, public API key) and ordinary `authenticated`
-- callers could invoke them via PostgREST /rest/v1/rpc/<fn>. SECURITY DEFINER bypasses RLS,
-- so this exposed sensitive primitives (e.g. safe_select — arbitrary read; enqueue_* — SMS/cost;
-- cron_pause/cron_resume — job control / DoS; *_cleanup — data deletion).
--
-- Fix: REVOKE EXECUTE FROM PUBLIC, anon, authenticated and re-GRANT to service_role only.
-- The application invokes these exclusively via the service-role client (supabaseAdmin); pg_cron
-- runs them as a superuser. So service_role retains access and the app is unaffected, while the
-- anon/authenticated RPC surface is closed.
--
-- VERIFIED PREREQUISITES (rqdnxdvuypekpmxbteju, 2026-06-30):
--   * Return type: all 16 below return a non-trigger type (RPC-callable). PostgREST cannot expose
--     trigger-returning functions, so the 3 trigger functions are intentionally NOT touched:
--     audit_row_change(), escalate_complaint_to_principal(), mask_aadhaar_number().
--   * RLS references: only current_principal_staff_id() (6 policies) and current_teacher_staff_id()
--     (14 policies) are referenced inside RLS policies; they MUST remain executable by
--     authenticated/anon for policy evaluation and self-gate via auth.uid(). They are intentionally
--     NOT touched.
--   * service_role_exec was true for all (via PUBLIC); re-granting service_role preserves app access.

-- can_manage_fees(p_role text)
revoke execute on function public.can_manage_fees(p_role text) from public, anon, authenticated;
grant  execute on function public.can_manage_fees(p_role text) to service_role;

-- check_institution_consistency()
revoke execute on function public.check_institution_consistency() from public, anon, authenticated;
grant  execute on function public.check_institution_consistency() to service_role;

-- claim_pending_notifications(batch_cap integer)
revoke execute on function public.claim_pending_notifications(batch_cap integer) from public, anon, authenticated;
grant  execute on function public.claim_pending_notifications(batch_cap integer) to service_role;

-- classroom_proofs_cleanup()
revoke execute on function public.classroom_proofs_cleanup() from public, anon, authenticated;
grant  execute on function public.classroom_proofs_cleanup() to service_role;

-- cron_pause(p_jobname text)
revoke execute on function public.cron_pause(p_jobname text) from public, anon, authenticated;
grant  execute on function public.cron_pause(p_jobname text) to service_role;

-- cron_resume(p_jobname text)
revoke execute on function public.cron_resume(p_jobname text) from public, anon, authenticated;
grant  execute on function public.cron_resume(p_jobname text) to service_role;

-- cron_status(p_jobname text)
revoke execute on function public.cron_status(p_jobname text) from public, anon, authenticated;
grant  execute on function public.cron_status(p_jobname text) to service_role;

-- dispatch_fee_sms_tick()
revoke execute on function public.dispatch_fee_sms_tick() from public, anon, authenticated;
grant  execute on function public.dispatch_fee_sms_tick() to service_role;

-- dispatch_notifications_tick()
revoke execute on function public.dispatch_notifications_tick() from public, anon, authenticated;
grant  execute on function public.dispatch_notifications_tick() to service_role;

-- enqueue_fee_receipt(p_fee_id uuid)
revoke execute on function public.enqueue_fee_receipt(p_fee_id uuid) from public, anon, authenticated;
grant  execute on function public.enqueue_fee_receipt(p_fee_id uuid) to service_role;

-- enqueue_login_credentials(p_school uuid, p_student_ids uuid[], p_send_parent boolean, p_send_student boolean, p_regenerate boolean)
revoke execute on function public.enqueue_login_credentials(p_school uuid, p_student_ids uuid[], p_send_parent boolean, p_send_student boolean, p_regenerate boolean) from public, anon, authenticated;
grant  execute on function public.enqueue_login_credentials(p_school uuid, p_student_ids uuid[], p_send_parent boolean, p_send_student boolean, p_regenerate boolean) to service_role;

-- enqueue_overdue_fee_reminders(p_school uuid, p_min_gap_days integer)
revoke execute on function public.enqueue_overdue_fee_reminders(p_school uuid, p_min_gap_days integer) from public, anon, authenticated;
grant  execute on function public.enqueue_overdue_fee_reminders(p_school uuid, p_min_gap_days integer) to service_role;

-- failed_logins_last_10m(p_ip text)
revoke execute on function public.failed_logins_last_10m(p_ip text) from public, anon, authenticated;
grant  execute on function public.failed_logins_last_10m(p_ip text) to service_role;

-- safe_select(p_query text)
revoke execute on function public.safe_select(p_query text) from public, anon, authenticated;
grant  execute on function public.safe_select(p_query text) to service_role;

-- should_block_ip(p_ip text)
revoke execute on function public.should_block_ip(p_ip text) from public, anon, authenticated;
grant  execute on function public.should_block_ip(p_ip text) to service_role;

-- teacher_geo_pings_cleanup()
revoke execute on function public.teacher_geo_pings_cleanup() from public, anon, authenticated;
grant  execute on function public.teacher_geo_pings_cleanup() to service_role;
