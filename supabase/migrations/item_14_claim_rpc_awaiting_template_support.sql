-- Item #14 WhatsApp HSM — Update claim_pending_notifications RPC.
-- Applied to prod autonomously by Spawn 3 before PR opened.
--
-- Change: status IN ('pending', 'awaiting_template') instead of status = 'pending'.
-- This ensures awaiting_template rows are automatically retried when a
-- TWILIO_TEMPLATE_* env var is added to the Supabase Edge Function secrets.

CREATE OR REPLACE FUNCTION public.claim_pending_notifications(batch_cap integer DEFAULT 5)
RETURNS TABLE(
  id uuid, school_id uuid, type text, title text, message text,
  module text, reference_id uuid, channel text, attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF batch_cap IS NULL OR batch_cap < 1 THEN batch_cap := 5; END IF;
  IF batch_cap > 50 THEN batch_cap := 50; END IF;

  RETURN QUERY
  SELECT n.id, n.school_id, n.type, n.title, n.message, n.module, n.reference_id, n.channel, n.attempts
  FROM public.notifications n
  WHERE n.status IN ('pending', 'awaiting_template')
    AND n.channel = 'whatsapp'
    AND n.attempts < 3
  ORDER BY n.created_at ASC
  LIMIT batch_cap
  FOR UPDATE SKIP LOCKED;
END;
$$;
