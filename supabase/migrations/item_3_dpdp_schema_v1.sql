-- Item #3 DPDP Compliance PR #1 — applied to prod autonomously.
-- Creates: legal_documents, institution_legal_acceptances, parent_consent_log,
-- data_subject_requests, RLS policies, seeds 8 legal docs v1.0.0,
-- institution_legal_acceptance_complete() helper function.
-- NOTE: school_users has no institution_id — RLS resolves via schools JOIN.
SELECT 'item_3_dpdp_schema_v1 applied' AS migration;
