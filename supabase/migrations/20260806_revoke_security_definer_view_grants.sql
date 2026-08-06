-- SECURITY (Wave 12) — revoke public/anon/authenticated access to SECURITY DEFINER views.
--
-- Finding: these 14 views are SECURITY DEFINER (they run with the definer's rights,
-- bypassing RLS) AND had SELECT granted to anon + authenticated. Because the anon key
-- is public, this exposed cross-tenant data — student status, auth/security telemetry
-- (IP threat scores, auth events, school auth health), and cross-school/ICDS/MEO
-- summaries — to anyone with the public key. Same class as BUG-004 (safe_select).
--
-- Fix: revoke all privileges from anon, authenticated, and public. The application
-- backend uses the service_role client (verified to retain SELECT on all 14 views),
-- so this closes the exposure without breaking any server-side reads.
--
-- Applied live to project rqdnxdvuypekpmxbteju on 2026-08-06. This migration is the
-- record + reproducibility for other environments.
--
-- Follow-up (defense in depth, separate change): recreate these views WITH
-- (security_invoker = on) so RLS on the base tables applies even if a grant is
-- ever re-added.

revoke all privileges on
  public.student_current_status,
  public.obs_failed_notifications,
  public.obs_stuck_queue,
  public.obs_cron_health,
  public.obs_stale_briefings,
  public.obs_failed_integrations,
  public.obs_health_summary,
  public.v_today_attendance_summary,
  public.v_meo_school_summary,
  public.v_auth_events_24h,
  public.v_ip_threat_scores,
  public.v_school_auth_health,
  public.v_icds_monthly_summary,
  public.vw_student_vidya_grid_status
from anon, authenticated, public;
