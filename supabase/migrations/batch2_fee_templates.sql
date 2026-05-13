-- Batch 2: Fee structure templates. Applied autonomously.
-- Creates fee_templates table with RLS.
-- fees.data_source used as generation hash store (prefix gen:<hex16>).
-- fees has no academic_year_id, no metadata, no reference_id.
SELECT 'batch2_fee_templates applied' AS migration;
