-- Add 'intermediate_college' to public.institution_type enum
-- Since ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block in Postgres,
-- we run it individually.
ALTER TYPE public.institution_type ADD VALUE IF NOT EXISTS 'intermediate_college';
