-- SECURITY (Wave 12) — lock operational SECURITY DEFINER functions to service_role.
--
-- Finding: these functions are SECURITY DEFINER and were EXECUTE-able by anon /
-- authenticated (via the default PUBLIC grant). They are operational/cron RPCs the
-- public key should never call — cron control, notification/SMS dispatch ticks,
-- message enqueue (including login credentials), queue claim, cleanups, and
-- complaint escalation. Exposed, they enable DoS (pause cron), message spam, and
-- credential-send abuse.
--
-- Fix: REVOKE EXECUTE FROM public, anon, authenticated and re-GRANT to service_role
-- (the BUG-004 pattern) so cron (postgres) and the backend (service_role) keep
-- working. Verified anon/authenticated EXECUTE = 0 after. Applied live 2026-08-06.
--
-- Deliberately NOT touched: RLS-helper functions (current_teacher_staff_id,
-- current_principal_staff_id, can_manage_fees, should_block_ip, mask_aadhaar_number,
-- failed_logins_last_10m, check_institution_consistency) and the audit_row_change
-- trigger function — revoking those could break RLS evaluation or is a no-op.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'cron_pause','cron_resume','cron_status',
        'dispatch_fee_sms_tick','dispatch_notifications_tick',
        'enqueue_fee_receipt','enqueue_login_credentials','enqueue_overdue_fee_reminders',
        'claim_pending_notifications','classroom_proofs_cleanup',
        'teacher_geo_pings_cleanup','escalate_complaint_to_principal')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
