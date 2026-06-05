# Phase D Migration — Apply Instructions

## Status
Migration file `supabase/migrations/20260605_phase_d_branding_fee_templates_parent_auth.sql`  
was committed to `main` on 2026-06-05 but **was not applied** to the Supabase project  
`rqdnxdvuypekpmxbteju` (verified via `information_schema.columns` — 0 of 7 branding columns  
and `auth_user_id` are absent from `schools`/`parents`).

## Apply Now

Run in Supabase Dashboard SQL Editor (project: `rqdnxdvuypekpmxbteju`) or via CLI:

```bash
npx supabase db push --db-url $DATABASE_URL
```

Or paste the migration SQL directly:

```sql
-- 1. BRANDING COLUMNS ON schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS seal_url         TEXT,
  ADD COLUMN IF NOT EXISTS signature_url    TEXT,
  ADD COLUMN IF NOT EXISTS primary_color    VARCHAR(7),
  ADD COLUMN IF NOT EXISTS secondary_color  VARCHAR(7),
  ADD COLUMN IF NOT EXISTS font_family      TEXT,
  ADD COLUMN IF NOT EXISTS tagline          TEXT,
  ADD COLUMN IF NOT EXISTS website          TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS contact_email    TEXT;

-- 2. FEE TEMPLATE FK on fees
ALTER TABLE fees
  ADD COLUMN IF NOT EXISTS template_id UUID
    REFERENCES fee_templates(id) ON DELETE SET NULL;

-- 3. PARENT AUTH USER ID
ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS auth_user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS parents_auth_user_id_idx ON parents(auth_user_id);

-- 4. MULTI-CHILD RLS
DROP POLICY IF EXISTS "parents_own_record" ON parents;
DROP POLICY IF EXISTS "parent_own_row"     ON parents;

CREATE POLICY "parent_see_own_linked_record" ON parents
  FOR SELECT USING (
    auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "parent_children_select" ON students;

CREATE POLICY "parent_children_select" ON students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_students ps
      JOIN parents p ON p.id = ps.parent_id
      WHERE ps.student_id = students.id
        AND p.auth_user_id = auth.uid()
    )
  );
```

## Verification After Apply

```sql
-- Should return 7 rows
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'schools'
  AND column_name IN ('seal_url','signature_url','primary_color','secondary_color','font_family','tagline','website');

-- Should return 1 row
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'parents'
  AND column_name = 'auth_user_id';
```

## Blocker After Apply

`auth_user_id` column will exist but all 320 parents will have `auth_user_id = NULL`.
Parent portal login currently uses **phone + PIN** (not Supabase Auth) — this is operational  
and works independently of `auth_user_id`. The `auth_user_id` backfill is needed only for  
RLS-gated routes using `auth.uid()`. The phone+PIN parent portal is unblocked today.
