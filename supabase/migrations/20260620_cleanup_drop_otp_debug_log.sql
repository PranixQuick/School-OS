-- Cleanup: remove the temporary OTP go-live diagnostic table (added in PR #210).
-- The diagnostic served its purpose (root-caused the MSG91 OTP->Flow API fix, PR #211).
-- Already applied to the DB on 2026-06-20; this file records it for repeatability.
-- Safe: the only writer was sendViaMsg91's swallowed insert, removed in this same PR.

drop table if exists public.otp_debug_log;