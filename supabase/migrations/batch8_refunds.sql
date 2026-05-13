-- Batch 8: Add refund columns to fees table.
-- gst_rate + tax_amount already existed.
-- Applied live: refund_amount, refund_status (check: none/requested/processing/completed/failed),
-- refund_at, razorpay_refund_id. Index on (school_id, refund_status) WHERE != 'none'.
SELECT 'batch8_refunds applied' AS migration;
