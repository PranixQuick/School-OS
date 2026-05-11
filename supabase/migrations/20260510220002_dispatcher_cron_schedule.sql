-- Item 14a — notifications dispatcher cron schedule
--
-- Schedules a pg_cron job that calls the notifications-dispatcher Edge Function
-- every 5 minutes (PRE-FLIGHT-D answer).
--
-- The cron command calls a SECURITY DEFINER wrapper function
-- public.dispatch_notifications_tick() which:
--   1. Reads the X-DISPATCH-SECRET value from vault.decrypted_secrets
--      (vault secret name: 'notifications_dispatcher_secret')
--   2. Calls net.http_post to the Edge Function URL with the header set
--
-- This indirection means:
--   - The secret value isn't in pg_cron's stored command string (would be world-readable)
--   - Operations can rotate the secret by updating the vault entry without re-scheduling cron
--
-- FOUNDER ACTION REQUIRED AFTER MIGRATION APPLIES (closeout message will reiterate):
--   1. Create the vault secret:
--        SELECT vault.create_secret('CHOOSE_A_LONG_RANDOM_STRING', 'notifications_dispatcher_secret');
--   2. Set the SAME value as DISPATCH_SECRET env var on the Edge Function
--   3. Verify the cron tick works by waiting 5 min then querying
--      cron.job_run_details ORDER BY end_time DESC LIMIT 1.

CREATE OR REPLACE FUNCTION public.dispatch_notifications_tick()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  -- Look up the dispatcher secret from vault. If it doesn't exist, abort.
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'notifications_dispatcher_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE WARNING 'dispatch_notifications_tick: vault secret "notifications_dispatcher_secret" missing — skipping tick';
    RETURN NULL;
  END IF;

  -- Fire the HTTP POST. net.http_post returns a request_id (async).
  -- Edge Function URL: project-specific; substitute project ref at apply time.
  SELECT net.http_post(
    url := 'https://rqdnxdvuypekpmxbteju.supabase.co/functions/v1/notifications-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-DISPATCH-SECRET', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.dispatch_notifications_tick() IS
  'Item 14a: Cron-invoked function that calls the notifications-dispatcher Edge Function with the X-DISPATCH-SECRET header. Reads secret from vault to avoid storing it in pg_cron command text.';

-- Schedule the cron job every 5 minutes.
-- Note: if a 'schoolos_notifications_dispatcher' job already exists (e.g. from a retry),
-- this CREATE OR REPLACE pattern via cron.unschedule + cron.schedule prevents conflicts.
DO $$
DECLARE
  v_existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_existing_jobid
  FROM cron.job
  WHERE jobname = 'schoolos_notifications_dispatcher'
  LIMIT 1;

  IF v_existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_jobid);
    RAISE NOTICE 'Unscheduled existing schoolos_notifications_dispatcher job (jobid=%)', v_existing_jobid;
  END IF;

  PERFORM cron.schedule(
    'schoolos_notifications_dispatcher',
    '*/5 * * * *',
    $cron_cmd$SELECT public.dispatch_notifications_tick();$cron_cmd$
  );
  RAISE NOTICE 'Scheduled schoolos_notifications_dispatcher to run every 5 minutes';
END $$;
