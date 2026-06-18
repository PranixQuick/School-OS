-- 20260618_iss07_vendor_type_books_uniform.sql
-- ISS-7 (P3.2a): allow 'books' and 'uniform' vendor types.
--
-- #7 needs book and uniform suppliers in addition to the existing vendor types.
-- Widening a CHECK allow-list cannot invalidate any existing row (and vendors is
-- empty today), so this is provably safe and non-breaking.

BEGIN;

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_vendor_type_check;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_vendor_type_check
  CHECK (vendor_type = ANY (ARRAY[
    'transport', 'food', 'maintenance', 'security', 'it', 'stationery',
    'books', 'uniform', 'other'
  ]));

COMMIT;

-- Rollback (only safe while no vendor uses 'books'/'uniform'):
--   ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_vendor_type_check;
--   ALTER TABLE public.vendors ADD CONSTRAINT vendors_vendor_type_check
--     CHECK (vendor_type = ANY (ARRAY['transport','food','maintenance','security','it','stationery','other']));
