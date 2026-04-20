-- Phase 0 Task 0.5 — abuse detection tables.
-- `alerts`      : signals from login-anomaly and webhook-spam watchers; daily digest reads this.
-- `blocked_ips` : append-only IP blocklist with TTL (blocked_until).

CREATE TABLE IF NOT EXISTS alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity        text NOT NULL CHECK (severity IN ('info','warn','critical')),
  category        text NOT NULL,
  school_id       uuid REFERENCES schools(id) ON DELETE SET NULL,
  payload         jsonb NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_unack
  ON alerts(created_at DESC) WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_category_created
  ON alerts(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_school_created
  ON alerts(school_id, created_at DESC) WHERE school_id IS NOT NULL;

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS svc_all_alerts         ON alerts;
DROP POLICY IF EXISTS auth_read_alerts       ON alerts;
DROP POLICY IF EXISTS auth_update_alerts     ON alerts;

CREATE POLICY svc_all_alerts ON alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users see alerts scoped to their own school. System-wide alerts
-- (school_id IS NULL) are service-role / super_admin only.
CREATE POLICY auth_read_alerts ON alerts
  FOR SELECT TO authenticated
  USING (school_id IS NOT NULL AND school_id = current_school_id());

-- Acknowledging an alert is limited to owner/principal/super_admin within the
-- owning school.
CREATE POLICY auth_update_alerts ON alerts
  FOR UPDATE TO authenticated
  USING (school_id IS NOT NULL AND school_id = current_school_id())
  WITH CHECK (
    school_id IS NOT NULL
    AND school_id = current_school_id()
    AND current_user_role() IN ('owner','principal','super_admin')
  );

CREATE TABLE IF NOT EXISTS blocked_ips (
  ip             inet PRIMARY KEY,
  reason         text,
  blocked_until  timestamptz NOT NULL,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_until ON blocked_ips(blocked_until);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS svc_all_blocked_ips ON blocked_ips;

CREATE POLICY svc_all_blocked_ips ON blocked_ips
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Sweep function: clears expired block rows. Called from the same hourly cron
-- as webhook_rate_sweep, or on-demand.
CREATE OR REPLACE FUNCTION blocked_ips_sweep()
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM blocked_ips WHERE blocked_until < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
