-- Phase 0 Task 0.2 — RLS helper functions + audit function.
-- current_school_id() and current_user_role() are read inside tenant-aware
-- policies. They read from the Supabase-issued JWT (user_metadata first, then
-- top-level). For service_role requests the JWT has neither, so these return
-- NULL and the service-role ALL policy (which does not reference them) applies.

CREATE OR REPLACE FUNCTION current_school_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid,
      (auth.jwt() ->> 'school_id')::uuid
    );
$$;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS text
  LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
      auth.jwt() -> 'user_metadata' ->> 'user_role',
      auth.jwt() ->> 'user_role'
    );
$$;

-- rls_audit returns three lists: public tables with RLS disabled, tables whose
-- only policies are permissive (qual=true) for non-service roles, and the
-- expected tenant-scoped tables that don't yet have an authenticated policy
-- referencing current_school_id(). Consumed by lib/rls-guard.ts.
CREATE OR REPLACE FUNCTION rls_audit()
RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'public_tables_without_rls', COALESCE((
      SELECT jsonb_agg(tablename ORDER BY tablename)
      FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = false
    ), '[]'::jsonb),

    'tables_with_only_permissive_policies', COALESCE((
      SELECT jsonb_agg(tablename ORDER BY tablename) FROM (
        SELECT DISTINCT t.tablename
        FROM pg_tables t
        WHERE t.schemaname = 'public'
          AND t.rowsecurity = true
          AND EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public'
              AND p.tablename  = t.tablename
              AND (p.qual = 'true' OR p.qual IS NULL)
              AND (p.with_check = 'true' OR p.with_check IS NULL)
              AND NOT ('service_role' = ANY(p.roles))
          )
          AND NOT EXISTS (
            SELECT 1 FROM pg_policies p2
            WHERE p2.schemaname = 'public'
              AND p2.tablename  = t.tablename
              AND 'authenticated' = ANY(p2.roles)
              AND p2.qual LIKE '%current_school_id%'
          )
      ) x
    ), '[]'::jsonb),

    'tenant_tables_missing_strict_policy', COALESCE((
      SELECT jsonb_agg(expected ORDER BY expected) FROM (
        SELECT expected FROM unnest(ARRAY[
          'school_users','students','staff','parents','attendance','fees',
          'academic_records','report_narratives','conversations','notifications',
          'events','inquiries','ptm_sessions','ptm_slots','student_risk_flags',
          'broadcasts','teacher_attendance'
        ]) AS expected
        EXCEPT
        SELECT DISTINCT tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND 'authenticated' = ANY(roles)
          AND qual LIKE '%current_school_id%'
      ) y
    ), '[]'::jsonb)
  );
$$;
