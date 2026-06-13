-- Migration: Deactivate active test-shell institutions (data hygiene)
-- Date:      2026-06-13
-- Context:   Pre-public-launch data hygiene for SchoolOS / EdProSys.
--
-- Per the master demo credentials sheet (reconciled from the live database on
-- 2026-06-12, section "Known gaps & honest notes"), the "Peddapalli"-suffixed
-- colleges are test shells -- NOT demo institutions and NOT real customers --
-- yet they remain is_active = true in production. A public launch must not
-- surface test institutions in active listings, search, or oversight rollups.
--
-- This migration deactivates ONLY the two explicitly-documented active test
-- shells. It is scoped by primary key, idempotent (guarded by is_active),
-- and fully reversible (see rollback block at the bottom).
--
-- Deactivated by this migration:
--   866d51a4-a385-44ea-a5b6-8057d1b73a5b  Govt Degree College Peddapalli  (test shell)
--   499f27b8-3543-4115-adf6-82c0e6e1e2ce  Govt Junior College Peddapalli  (test shell)
--
-- DELIBERATELY NOT TOUCHED -- require founder decision (undocumented active rows
-- that may be real onboarded institutions; do NOT auto-deactivate):
--   45c5d164-f482-4b6b-94bc-b7a91ed75068  Adarsha Junior College
--   1d040bbe-662f-4e70-b07f-a46026f59243  Sri Vidya Degree College
--
-- Already inactive (no action needed): E2E Test School, Sunrise Academy,
--   Delhi Public School Nadergul, "adasda", ZPHS Godavarikhani / Manthani /
--   Sultanabad (MEO-onboarded test shells).
--
-- Preserved / untouched (demo + real, remain active): Suchitra Academy,
--   ZPHS Peddapalli, Anganwadi Ward 3, Govt Junior College Demo,
--   Govt Degree College Demo.

begin;

update public.schools
   set is_active = false
 where id in (
         '866d51a4-a385-44ea-a5b6-8057d1b73a5b',  -- Govt Degree College Peddapalli
         '499f27b8-3543-4115-adf6-82c0e6e1e2ce'   -- Govt Junior College Peddapalli
       )
   and is_active = true;

commit;

-- Rollback (manual, if ever needed):
-- update public.schools set is_active = true
--  where id in ('866d51a4-a385-44ea-a5b6-8057d1b73a5b',
--               '499f27b8-3543-4115-adf6-82c0e6e1e2ce');
