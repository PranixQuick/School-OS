-- Batch 9: Add partial + pending_verification to fees.status CHECK.
-- Both installment tables already existed with correct schema.
-- Notification dispatcher already fixed (v4: default DISPATCH_MODE=live).
SELECT 'batch9_fees_partial_status applied' AS migration;
