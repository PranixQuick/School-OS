-- 20260701_stakeholder_documents.sql
-- Add document_url tracking columns to students, staff, and vendors tables

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS document_url TEXT;
