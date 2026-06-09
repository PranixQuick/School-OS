-- =============================================================================
-- PR-103: fee_categories
-- Hotfix: drop duplicate trigger audit_fees (preserve trg_audit_fees)
-- =============================================================================

-- STEP 0 — hotfix: drop the duplicate bare-name trigger, keep trg_audit_fees
DROP TRIGGER IF EXISTS audit_fees ON public.fees;

-- STEP 1 — fee_categories table
CREATE TABLE IF NOT EXISTS public.fee_categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fee_categories_name_school_unique UNIQUE (school_id, name)
);

-- STEP 2 — indexes
CREATE INDEX IF NOT EXISTS idx_fee_categories_school_id
  ON public.fee_categories (school_id);

CREATE INDEX IF NOT EXISTS idx_fee_categories_school_active
  ON public.fee_categories (school_id, is_active);

-- STEP 3 — updated_at auto-trigger
CREATE OR REPLACE FUNCTION public.set_fee_categories_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fee_categories_updated_at ON public.fee_categories;
CREATE TRIGGER trg_fee_categories_updated_at
  BEFORE UPDATE ON public.fee_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_fee_categories_updated_at();

-- STEP 4 — RLS
ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

-- Admin / accountant / owner can read their school's categories
DROP POLICY IF EXISTS fee_categories_select ON public.fee_categories;
CREATE POLICY fee_categories_select ON public.fee_categories
  FOR SELECT USING (
    school_id = (SELECT school_id FROM public.school_users
                  WHERE user_id = auth.uid() LIMIT 1)
  );

-- Only admin / owner can insert
DROP POLICY IF EXISTS fee_categories_insert ON public.fee_categories;
CREATE POLICY fee_categories_insert ON public.fee_categories
  FOR INSERT WITH CHECK (
    school_id = (SELECT school_id FROM public.school_users
                  WHERE user_id = auth.uid()
                    AND role IN ('admin','owner')
                  LIMIT 1)
  );

-- Only admin / owner can update
DROP POLICY IF EXISTS fee_categories_update ON public.fee_categories;
CREATE POLICY fee_categories_update ON public.fee_categories
  FOR UPDATE USING (
    school_id = (SELECT school_id FROM public.school_users
                  WHERE user_id = auth.uid()
                    AND role IN ('admin','owner')
                  LIMIT 1)
  );

-- DELETE is intentionally blocked (deactivate instead)
DROP POLICY IF EXISTS fee_categories_delete ON public.fee_categories;
-- no DELETE policy = DELETE blocked by RLS
