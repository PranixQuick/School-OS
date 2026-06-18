-- 20260618_iss07_vendor_access_pin.sql
-- ISS-7 (P3.2b): vendor portal login credential.
--
-- Vendors had portal_email + has_portal_access but no credential. This adds a
-- bcrypt-hashed PIN so a vendor granted portal access can log in with
-- portal_email + PIN (mirrors parents.access_pin_hashed / student auth).
--
-- Additive + safe: new nullable column; every existing vendor row starts NULL
-- (no portal login until an admin grants access and sets a PIN).

BEGIN;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS access_pin_hashed text;

COMMIT;

-- Rollback:
--   ALTER TABLE public.vendors DROP COLUMN IF EXISTS access_pin_hashed;
