-- BUG-004 (Critical): public.safe_select(text) executes arbitrary caller-supplied SQL
-- via `EXECUTE format('SELECT jsonb_agg(t) FROM (%s LIMIT 1000) t', p_query)` as
-- SECURITY DEFINER. It carried EXECUTE grants for `anon` and `authenticated`
-- (plus the default PUBLIC grant every Postgres function gets unless explicitly
-- revoked), making it callable by ANY unauthenticated caller with the project's
-- public anon key via PostgREST at /rest/v1/rpc/safe_select — bypassing this
-- app's own custom-cookie auth entirely and, being SECURITY DEFINER, very likely
-- bypassing RLS/tenant isolation on whatever table was queried.
--
-- Found via Supabase's built-in security advisor during Wave 12 Release
-- Certification (2026-08-05). Applied directly to production (founder-authorized)
-- ahead of this file being merged, given the severity — this migration exists so
-- the repo's history matches what's actually live and so this fix survives a
-- fresh environment setup. Re-verified post-fix via two independent read paths:
-- only `postgres` and `service_role` retain EXECUTE. The app's own backend only
-- ever calls Supabase via the service-role client, so nothing in the app depends
-- on the revoked access — this only closes the public/anonymous attack surface.
--
-- See docs/11_Bug_Registry/BUG_REGISTRY.md BUG-004 for full details.

REVOKE EXECUTE ON FUNCTION public.safe_select(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.safe_select(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.safe_select(text) FROM authenticated;
