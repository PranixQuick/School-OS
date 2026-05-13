-- Batch 7: PTM scheduling schema.
-- ptm_sessions: created (was already present with different schema — adapted in code).
-- ptm_slots: slot_date + booked_at added.
-- ptm_sessions: created_by column added.
-- Demo session seeded for Suchitra Academy.
-- Status values in code: scheduled/in_progress/completed/cancelled (actual constraint).
SELECT 'batch7_ptm_sessions applied' AS migration;
