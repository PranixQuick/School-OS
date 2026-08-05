# Stakeholder Catalogue

This catalogue lists the complete, real set of stakeholders implemented in School-OS, derived by cross-referencing database migrations, codebase authorization guards, and the Next.js page routing structures.

---

## Master Stakeholder Catalogue

### STK-001: Owner
* **Role Value:** `owner`
* **Canonical Role:** `owner`
* **Code Enforcement:** Enforced in [owner-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/owner-auth.ts#L34-L38) via `requireOwnerSession(req)` which verifies that `session.userRole === 'owner'`.
* **UI Portal:** [app/owner/](file:///c:/Users/ADMIN/School-OS/app/owner/)
* **Distinguishing Scope:** Institution-scoped. Resolves and grants access to all schools sharing the owner's `institution_id` (via `school_users.institution_id` lookup).

### STK-002: Principal
* **Role Value:** `principal`
* **Canonical Role:** `principal` (DB maps `dean` -> `principal` in `public.canonical_role`)
* **Code Enforcement:** Enforced in [principal-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/principal-auth.ts#L42-L49) via `requirePrincipalSession(req)` which checks `session.userRole === 'principal'`.
* **UI Portal:** [app/principal/](file:///c:/Users/ADMIN/School-OS/app/principal/)
* **Distinguishing Scope:** School-scoped. Must be linked to a valid `staff_id` in `school_users` table matching the session's active school.

### STK-003: Admin Staff
* **Role Value:** `admin_staff` (legacy string `admin` maps to `admin_staff` in database)
* **Canonical Role:** `admin` (DB maps `admin_staff` and legacy `admin` -> `admin` in `public.canonical_role`)
* **Code Enforcement:** Enforced in [admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L27-L40) via `requireAdminSession(req)` where `ALLOWED_ROLES` permits `admin_staff` and legacy `admin` roles. Also validated in [authz.ts](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L31-L38) (`canManageAcademicEntities`).
* **UI Portal:** [app/admin/](file:///c:/Users/ADMIN/School-OS/app/admin/)
* **Distinguishing Scope:** School-scoped. Has general operational management access over school settings, templates, structure, and imports.

### STK-004: Teacher
* **Role Value:** `teacher`
* **Canonical Role:** `teacher` (DB maps `teacher` -> `teacher` in `public.canonical_role`)
* **Code Enforcement:** Enforced in [teacher-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/teacher-auth.ts#L52-L59) via `requireTeacherSession(req)` which checks `session.userRole === 'teacher'`.
* **UI Portal:** [app/teacher/](file:///c:/Users/ADMIN/School-OS/app/teacher/) and [app/teacher-eval/](file:///c:/Users/ADMIN/School-OS/app/teacher-eval/)
* **Distinguishing Scope:** School-scoped. Access to class rosters, student attendance marking, and homework creation. Linked to `staff_id` in `school_users`.

### STK-005: Head of Department (HOD)
* **Role Value:** `hod`
* **Canonical Role:** `teacher` (DB function `public.canonical_role` normalizes `hod` -> `teacher`)
* **Code Enforcement:** Enforced in [hod-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/hod-auth.ts#L12-L19) via `requireHodSession(req)` which gates on `session.userRole === 'hod'` and requires `session.hod_scope` to be non-empty.
* **UI Portal:** [app/hod/](file:///c:/Users/ADMIN/School-OS/app/hod/)
* **Distinguishing Scope:** Department-scoped. Access is restricted to specific departments and campuses defined in the `staff_hod_scope` table (embedded as claims in the `school_session` cookie).

### STK-006: Accountant
* **Role Value:** `accountant`
* **Canonical Role:** `accountant` (DB maps `accountant` -> `accountant` in `public.canonical_role`)
* **Code Enforcement:** Enforced in [admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L68-L75) within `requireAdminSession(req)` where users with `userRole === 'accountant'` (or role `admin` with designation `School Accountant`) are validated against `canAccountantAccess()` from [authz.ts](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L91-L95).
* **UI Portal:** [app/accountant/](file:///c:/Users/ADMIN/School-OS/app/accountant/) and [app/accounts/](file:///c:/Users/ADMIN/School-OS/app/accounts/)
* **Distinguishing Scope:** School-scoped but limited strictly to fee-domain routes in `ACCOUNTANT_ROUTE_ALLOWLIST`. Governed by the school's `accounting_mode` check.

### STK-007: Counsellor
* **Role Value:** `counsellor`
* **Canonical Role:** `counsellor` (DB maps `counsellor` -> `counsellor` in `public.canonical_role`)
* **Code Enforcement:** Allowed in [admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L29) (`requireAdminSession`) and [counsellor route](file:///c:/Users/ADMIN/School-OS/app/api/counsellor/dashboard/route.ts#L9) where `ALLOWED` includes `'counsellor'`.
* **UI Portal:** [app/counsellor/](file:///c:/Users/ADMIN/School-OS/app/counsellor/)
* **Distinguishing Scope:** School-scoped. Granted access to student risk flags, counselling logs, and session management.

### STK-008: Student
* **Role Value:** `student`
* **Canonical Role:** `student` (DB maps `student` -> `student` in `public.canonical_role`)
* **Code Enforcement:** Enforced in [student-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/student-auth.ts#L162-L166) via `requireStudentSession(req)` verifying the `student_session` cookie.
* **UI Portal:** [app/student/](file:///c:/Users/ADMIN/School-OS/app/student/)
* **Distinguishing Scope:** Student-scoped. Access is restricted to their own academic grades, timetables, and homework submissions.

### STK-009: Parent
* **Role Value:** `parent`
* **Canonical Role:** `parent` (DB maps `parent` -> `parent` in `public.canonical_role`)
* **Code Enforcement:** Enforced in [parent-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/parent-auth.ts#L87-L92) via `getParentSession(req)` verifying the `parent_session` cookie.
* **UI Portal:** [app/parent/](file:///c:/Users/ADMIN/School-OS/app/parent/)
* **Distinguishing Scope:** Parent-scoped. Limited strictly to details matching their child's `student_id` link.

### STK-010: Vendor
* **Role Value:** `vendor`
* **Canonical Role:** `vendor` (DB maps `vendor` -> `vendor` in `public.canonical_role`)
* **Code Enforcement:** Enforced in [vendor-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/vendor-auth.ts#L141-L145) via `requireVendorSession(req)` verifying the `vendor_session` cookie.
* **UI Portal:** [app/vendor/](file:///c:/Users/ADMIN/School-OS/app/vendor/)
* **Distinguishing Scope:** Vendor-scoped. Does not exist in the `school_users` table; instead, authenticates directly against the `vendors` table (requires `has_portal_access = true` and `is_active = true`).

### STK-011: Mandal Education Officer (MEO)
* **Role Value:** `meo`
* **Canonical Role:** `government` (DB function `canonical_role` normalizes `meo` -> `government`)
* **Code Enforcement:** Enforced in MEO API routes such as [dashboard route](file:///c:/Users/ADMIN/School-OS/app/api/meo/dashboard/route.ts#L17) checking role list inclusion.
* **UI Portal:** [app/meo/](file:///c:/Users/ADMIN/School-OS/app/meo/)
* **Distinguishing Scope:** Block/Mandal-scoped. Resolves schools in their mandal via `meo_mandal_mapping` linked to their `user_id`.

### STK-012: District Education Officer (DEO)
* **Role Value:** `deo`
* **Canonical Role:** `government` (DB function `canonical_role` normalizes `deo` -> `government`)
* **Code Enforcement:** Enforced in DEO API routes such as [dashboard route](file:///c:/Users/ADMIN/School-OS/app/api/deo/dashboard/route.ts#L14) checking role list inclusion.
* **UI Portal:** [app/deo/](file:///c:/Users/ADMIN/School-OS/app/deo/)
* **Distinguishing Scope:** District-scoped. aggregates mandal codes and compliance stats across their assigned district.

### STK-013: Registrar
* **Role Value:** `registrar`
* **Canonical Role:** `admin` (DB function `canonical_role` normalizes `registrar` -> `admin`)
* **Code Enforcement:** Enforced in registrar routes like [dashboard route](file:///c:/Users/ADMIN/School-OS/app/api/registrar/dashboard/route.ts#L11) checking role list inclusion.
* **UI Portal:** [app/registrar/](file:///c:/Users/ADMIN/School-OS/app/registrar/)
* **Distinguishing Scope:** School-scoped. General student registration and exam scheduler rights.

### STK-014: Librarian
* **Role Value:** `librarian`
* **Canonical Role:** `staff` (DB function `canonical_role` normalizes `librarian` -> `staff`)
* **Code Enforcement:** Checks standard session validation before displaying pages under `/app/librarian`.
* **UI Portal:** [app/librarian/](file:///c:/Users/ADMIN/School-OS/app/librarian/)
* **Distinguishing Scope:** School-scoped.

### STK-015: Hostel Admin
* **Role Value:** `hostel_admin` (maps `hostel_warden` -> `staff` too)
* **Canonical Role:** `staff` (DB function `canonical_role` normalizes `hostel_admin` -> `staff`)
* **Code Enforcement:** Checked in hostel UI pages.
* **UI Portal:** [app/hostel-admin/](file:///c:/Users/ADMIN/School-OS/app/hostel-admin/)
* **Distinguishing Scope:** School-scoped.

### STK-016: Anganwadi Worker (AWW)
* **Role Value:** `aww`
* **Canonical Role:** `anganwadi_worker` (DB function `canonical_role` normalizes `aww` -> `anganwadi_worker`)
* **Code Enforcement:** Enforced inside anganwadi folders and checkins.
* **UI Portal:** [app/anganwadi/](file:///c:/Users/ADMIN/School-OS/app/anganwadi/)
* **Distinguishing Scope:** Center-scoped (Anganwadi preschools operate as center schools/tenants).

### STK-017: Super Admin
* **Role Value:** `super_admin`
* **Canonical Role:** `super_admin` (DB maps `super_admin` -> `super_admin` in `canonical_role`)
* **Code Enforcement:** Enforced in [super-admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/super-admin-auth.ts#L16-L22) via `requireSuperAdmin()` which verifies the email domain ends with `@pranixailabs.com`.
* **UI Portal:** [app/super-admin/](file:///c:/Users/ADMIN/School-OS/app/super-admin/)
* **Distinguishing Scope:** Platform-wide scope. Bypasses standard institutional RLS checks.

### STK-018: Viewer
* **Role Value:** `viewer`
* **Canonical Role:** `viewer` (DB maps `viewer` -> `viewer` in `canonical_role`)
* **Code Enforcement:** Gated in [admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L42-L45) via `requireAdminSession` where `req.method !== 'GET'` throws 403.
* **UI Portal:** Shared under `/app/admin` (read-only mode).
* **Distinguishing Scope:** School-scoped. Strictly read-only access (no insertions, modifications, or deletes allowed).

---

## Discrepancies and Gap Analysis

During the stakeholder discovery phase, the following architectural discrepancies were identified between the database schema, code authentication checks, and the Next.js directory structure:

1. **Dead Roles (Defined in Enum comment but Unimplemented in Code):**
   * **`reception`** and **`admission_officer`**: Listed explicitly in the `lib/authz.ts` public user role comment as part of the 10-value enum set, and mapped in the database `public.canonical_role` function. However, there are no specific authentication helpers, middleware routes, or page folders (such as `/app/reception`) implemented for either role.
2. **Missing Enum Values in Authz Comments:**
   * **`counsellor`**, **`meo`**, and **`deo`**: Omitted from the 10-value list in `lib/authz.ts` line 4 enum comment. However, they are verified as valid DB `public.user_role` cast values in migration `20260627_g3_role_canonicalization.sql` and have active, distinct page portfolios (`/app/counsellor`, `/app/meo`, `/app/deo`) and backend route controllers.
3. **Out-of-Schema Actor (`vendor`):**
   * **`vendor`**: Completely missing from `school_users` table structure (vendors sign in with `vendor_session` using email and PIN verified directly against the `vendors` table in `lib/vendor-auth.ts`). They bypass the `user_role` DB enum but exist as a major system stakeholder.
4. **HOD & Viewer Code-Only Scoping:**
   * **`hod`** and **`viewer`**: Checked explicitly in next session files (`session.ts`, `hod-auth.ts`, `admin-auth.ts`) but are not distinct enum values in the `public.user_role` database table column.
