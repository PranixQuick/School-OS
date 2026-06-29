-- P0-02 / F-AUDIT-01: give fee amendments a persisted reason home.
-- Today only DELETE reason is stored (fees.delete_reason); amend reason has nowhere to live, and
-- 0/1876 fee audit rows carry metadata.reason. This adds the column; the handler wiring (separate)
-- writes it. Low-risk additive column. COMMIT ONLY — apply is a separate founder-gated DB step.
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS amend_reason text;
COMMENT ON COLUMN public.fees.amend_reason IS 'P0-02: reason for the most recent fee amendment (F-AUDIT-01).';
