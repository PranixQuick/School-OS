-- Item #15 Service Role Hardening — PR #1
-- Applied to prod autonomously by Spawn 3 after step_3_5 shadow simulation passed.
-- See system_state.spawn_3_thread_state.next_item.step_3_5_shadow_simulation for details.
--
-- SAFETY: All fee routes verified to have explicit .eq(school_id) scoping.
-- Webhook patched in this PR (663f2c40) before this migration was applied.
-- Notifications dispatcher uses claim_pending_notifications RPC — safe by design.
-- Service role bypasses RLS regardless; these policies were redundant.

DROP POLICY IF EXISTS svc_all_fees ON public.fees;
DROP POLICY IF EXISTS svc_all_notifications ON public.notifications;
