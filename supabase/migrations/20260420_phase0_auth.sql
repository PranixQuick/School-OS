-- Phase 0 Task 0.1 — auth migration
-- Adds auth.users linkage and migration timestamp to school_users.
-- Creates auth_events table for audit + rate-limit counting.
-- This file is the source of truth for a fresh `supabase db reset` and must match production.

ALTER TABLE school_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS password_migrated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_school_users_auth_user
  ON school_users(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_school_users_email_active
  ON school_users(email) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid,
  email text,
  event_type text NOT NULL CHECK (event_type IN (
    'login_success',
    'login_failure',
    'logout',
    'session_expired',
    'rate_limited',
    'password_migrated',
    'magic_link_sent',
    'magic_link_verified'
  )),
  ip inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_school_time ON auth_events(school_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_email_time  ON auth_events(email,      created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_type_time   ON auth_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip_time     ON auth_events(ip,         created_at DESC);

ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS svc_all_auth_events ON auth_events;
CREATE POLICY svc_all_auth_events ON auth_events FOR ALL TO service_role USING (true) WITH CHECK (true);
