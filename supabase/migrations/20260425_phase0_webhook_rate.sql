-- Phase 0 Task 0.3 — WhatsApp inbound webhook rate limiting.
-- Per-phone sliding minute-bucket counter. Atomic increment via webhook_rate_hit().

CREATE TABLE IF NOT EXISTS webhook_rate_log (
  phone         text        NOT NULL,
  minute_bucket timestamptz NOT NULL,
  count         int         NOT NULL DEFAULT 1,
  PRIMARY KEY (phone, minute_bucket)
);

CREATE INDEX IF NOT EXISTS idx_webhook_rate_bucket ON webhook_rate_log(minute_bucket);

ALTER TABLE webhook_rate_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS svc_all_webhook_rate_log ON webhook_rate_log;
CREATE POLICY svc_all_webhook_rate_log ON webhook_rate_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Atomic UPSERT + increment. Returns the new count for the current minute bucket.
CREATE OR REPLACE FUNCTION webhook_rate_hit(p_phone text)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_bucket timestamptz := date_trunc('minute', now());
  v_count  int;
BEGIN
  INSERT INTO webhook_rate_log (phone, minute_bucket, count)
  VALUES (p_phone, v_bucket, 1)
  ON CONFLICT (phone, minute_bucket) DO UPDATE
    SET count = webhook_rate_log.count + 1
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

-- TTL helper — deletes buckets older than 24h. Call from a daily cron
-- (added in Phase 0 Task 0.5 or a later ops phase).
CREATE OR REPLACE FUNCTION webhook_rate_sweep()
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM webhook_rate_log
  WHERE minute_bucket < now() - interval '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
