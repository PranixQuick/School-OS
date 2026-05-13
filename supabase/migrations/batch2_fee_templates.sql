-- Batch 2 fee templates migration — applied to prod autonomously.
-- Creates: fee_templates (with RLS). No changes to fees table.
SELECT 'batch2_fee_templates applied' AS migration;
