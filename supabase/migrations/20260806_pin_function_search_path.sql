-- SECURITY (Wave 12) — pin search_path on functions flagged with a mutable path.
--
-- An unset (mutable) search_path lets a caller prepend a schema and hijack
-- unqualified object references inside the function — a privilege-escalation
-- vector, especially for SECURITY DEFINER functions. The fix is to PIN the path.
-- We pin a broad, breakage-safe value (public, extensions, auth, pg_temp) that
-- covers the schemas these functions reference, so behaviour is unchanged.
-- ALTER FUNCTION ... SET search_path does not touch the function body.
-- Applied live 2026-08-06; verified 29/29 now have a pinned search_path.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname in (
      'current_school_id','current_user_role','rls_audit','webhook_rate_hit','webhook_rate_sweep',
      'blocked_ips_sweep','current_staff_id','check_institution_consistency','current_academic_year_id',
      'rbac_v2_enabled','teacher_geo_pings_cleanup','classroom_proofs_cleanup','current_principal_staff_id',
      'generate_tc_number','log_tc_event','institution_legal_acceptance_complete',
      'touch_parent_complaints_updated_at','mask_aadhaar_number','update_event_galleries_updated_at',
      'sync_gallery_media_counts','update_payroll_updated_at','claim_pending_notifications',
      'failed_logins_last_10m','should_block_ip','next_fee_receipt_no','safe_select',
      'set_fee_categories_updated_at','deny_mutation_payment_transactions','canonical_role')
  loop
    execute format('alter function %s set search_path = public, extensions, auth, pg_temp', r.sig);
  end loop;
end $$;
