-- 20260603_fee_receipt_numbering.sql
-- Fee receipt numbering: RCPT/{SCHOOL_CODE}/{ACADEMIC_YEAR}/{SEQ}
-- Additive + reversible. NO backfill (historical NULL fee_receipt_number rows untouched).
-- Consumed by lib/receipt.ts -> allocateReceiptNumber(), used in:
--   app/api/admin/fees/[id]/mark-paid, app/api/webhooks/razorpay, app/api/parent/fees/confirm-payment

-- 1. Founder-controlled per-school receipt prefix (app derives from slug when NULL).
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS receipt_prefix text;

-- 2. Per-(school, academic_year) monotonic counter.
CREATE TABLE IF NOT EXISTS public.fee_receipt_counters (
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  last_seq      integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, academic_year)
);

-- 3. Uniqueness of issued receipt numbers per school (partial: ignores historical NULLs).
CREATE UNIQUE INDEX IF NOT EXISTS uq_fees_school_receipt
  ON public.fees (school_id, fee_receipt_number)
  WHERE fee_receipt_number IS NOT NULL;

-- 4. Atomic allocator. Single-statement upsert+RETURNING => race-free under concurrency.
CREATE OR REPLACE FUNCTION public.next_fee_receipt_no(p_school uuid, p_ay text, p_prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE v_seq integer;
BEGIN
  INSERT INTO public.fee_receipt_counters (school_id, academic_year, last_seq)
  VALUES (p_school, p_ay, 1)
  ON CONFLICT (school_id, academic_year)
  DO UPDATE SET last_seq = public.fee_receipt_counters.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;
  RETURN 'RCPT/' || p_prefix || '/' || p_ay || '/' || lpad(v_seq::text, 6, '0');
END;
$$;

-- Rollback (manual):
--   DROP FUNCTION IF EXISTS public.next_fee_receipt_no(uuid, text, text);
--   DROP INDEX  IF EXISTS public.uq_fees_school_receipt;
--   DROP TABLE  IF EXISTS public.fee_receipt_counters;
--   ALTER TABLE public.schools DROP COLUMN IF EXISTS receipt_prefix;
