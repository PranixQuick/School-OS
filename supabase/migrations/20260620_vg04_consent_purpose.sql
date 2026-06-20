-- 20260620_vg04_consent_purpose.sql
-- VG-4 (DPDP) — add the 'adaptive_learning_ai' consent purpose.
--
-- The Vidya Grid SSO launch (VG-5) is gated on this consent being recorded for
-- the student's parent. Recording it requires the parent_consent_log.consent_type
-- CHECK to permit the new value. Widening an allow-list is additive/non-breaking;
-- all existing purposes remain valid. Idempotent (drop-if-exists then re-add).

begin;

alter table public.parent_consent_log
  drop constraint if exists parent_consent_log_consent_type_check;

alter table public.parent_consent_log
  add constraint parent_consent_log_consent_type_check
  check (consent_type = any (array[
    'data_processing'::text,
    'whatsapp_communication'::text,
    'data_retention'::text,
    'third_party_sharing'::text,
    'adaptive_learning_ai'::text
  ]));

commit;

-- Rollback (only if no adaptive_learning_ai rows exist):
--   alter table public.parent_consent_log drop constraint if exists parent_consent_log_consent_type_check;
--   alter table public.parent_consent_log add constraint parent_consent_log_consent_type_check
--     check (consent_type = any (array['data_processing','whatsapp_communication','data_retention','third_party_sharing']));
