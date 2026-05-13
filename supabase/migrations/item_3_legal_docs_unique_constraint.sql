-- Item #3 DPDP PR #2: micro-migration (Finding 1 fix)
-- Pre-check: no duplicate rows in legal_documents.
-- Adds explicit named unique constraint + seeds Suchitra Academy acceptances.

-- Named constraint (legal_documents_doc_type_version_key already exists from CREATE TABLE inline)
ALTER TABLE public.legal_documents
  ADD CONSTRAINT legal_documents_doc_type_version_unique UNIQUE (doc_type, version);

-- Seed Suchitra Academy institution acceptances
INSERT INTO public.institution_legal_acceptances
  (institution_id, legal_doc_id, doc_type, doc_version, accepted_by, ip_address, user_agent, context)
SELECT
  'afd2433e-bb1e-444c-9c03-cf62e84700c8'::uuid,
  ld.id, ld.doc_type, ld.version,
  (SELECT id FROM public.school_users WHERE email='admin@suchitracademy.edu.in' LIMIT 1),
  '127.0.0.1', 'Demo seed', 'onboarding'
FROM public.legal_documents ld WHERE ld.is_current = true
ON CONFLICT (institution_id, legal_doc_id) DO NOTHING;

-- Verify: 8 acceptances seeded
SELECT 'item_3_legal_docs_unique_constraint applied' AS migration;
