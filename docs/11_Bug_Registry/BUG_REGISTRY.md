# Bug Registry

This registry tracks all discovered defects under the EdProSys Production Certification Constitution.
Entries should never be overwritten, only appended or updated.

| Bug ID | Discovery Date | Discovered By | Severity | Repro Steps | Root Cause | Files Changed | Evidence Before/After | Regression Status | Production Status |
|--------|----------------|---------------|----------|-------------|------------|---------------|-----------------------|-------------------|-------------------|
| BUG-001 | 2026-08-05 | Antigravity (Wave 4 Dashboard Discovery), independently re-verified by Claude against live source | High | Log in with role `hostel_admin` and open `/hostel-admin` — every call to `/api/admin/hostel` (view rooms, view allocations, allocate, checkout) returns 403 Forbidden | `ALLOWED_ROLES` in `lib/admin-auth.ts` (`requireAdminSession`) is `{owner, principal, admin_staff, admin, accountant, viewer, counsellor}` — `hostel_admin` is not a member. `app/api/admin/hostel/route.ts` GET and POST both gate through `requireAdminSession`, so any `hostel_admin` session is rejected before any query runs. | `lib/admin-auth.ts` (fix not yet applied — fix branch requested) | Verified by direct read of both files on `docs/wave-4-dashboards`: ALLOWED_ROLES set confirmed missing `hostel_admin`; both HTTP handlers in the hostel route confirmed to call `requireAdminSession` unconditionally. | Fix pending | Live — hostel module is fully non-functional today for any user in the `hostel_admin` role |
