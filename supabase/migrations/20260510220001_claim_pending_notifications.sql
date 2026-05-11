-- Item 14a — claim_pending_notifications RPC
--
-- Atomically claims a batch of pending notifications using FOR UPDATE SKIP LOCKED
-- so concurrent dispatcher invocations don't double-process.
--
-- Returns rows still in 'pending' state. The caller (Edge Function) is responsible
-- for updating each row to 'dispatched' / 'failed' / 'skipped' after processing.
--
-- We do NOT mark rows as 'processing' here — the row stays 'pending' until the
-- dispatcher commits its update. This is safe because the surrounding transaction
-- holds the row lock for the duration of the dispatcher call. Concurrent ticks
-- skip locked rows via SKIP LOCKED.
--
-- Filter:
--   - status = 'pending'
--   - channel = 'whatsapp' (Item 14a scope; future channels add to this filter)
--   - attempts < 3 (give up after 3 attempts)

CREATE OR REPLACE FUNCTION public.claim_pending_notifications(batch_cap INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  module TEXT,
  reference_id UUID,
  channel TEXT,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clamp batch_cap defensively
  IF batch_cap IS NULL OR batch_cap < 1 THEN
    batch_cap := 5;
  END IF;
  IF batch_cap > 50 THEN
    batch_cap := 50;
  END IF;

  RETURN QUERY
  SELECT n.id, n.school_id, n.type, n.title, n.message, n.module, n.reference_id, n.channel, n.attempts
  FROM public.notifications n
  WHERE n.status = 'pending'
    AND n.channel = 'whatsapp'
    AND n.attempts < 3
  ORDER BY n.created_at ASC
  LIMIT batch_cap
  FOR UPDATE SKIP LOCKED;
END;
$$;

-- Grant execute to the service_role (Edge Function uses service role JWT to call this).
GRANT EXECUTE ON FUNCTION public.claim_pending_notifications(INTEGER) TO service_role;

COMMENT ON FUNCTION public.claim_pending_notifications(INTEGER) IS
  'Item 14a: Atomically claim a batch of pending notifications. Uses FOR UPDATE SKIP LOCKED to allow concurrent dispatchers without double-processing. Caller updates row state after processing.';
