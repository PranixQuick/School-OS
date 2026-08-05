# Owner Discovery

This document details the audit of the Owner role (`owner`) in School-OS to verify multi-tenant, multi-campus, switching, creation, deletion, delegation, billing, and isolation capabilities.

---

## Production-Readiness Gaps (Critical Findings)

Before listing the routine findings, the following critical gaps have been identified in the codebase that affect multi-campus trusts and production certification:

### 🚨 Critical RLS Policy Gaps on Hierarchy Tables
* **Code Location:** [20260505_phase1_hierarchy.sql:L155-L179](file:///c:/Users/ADMIN/School-OS/supabase/migrations/20260505_phase1_hierarchy.sql#L155-L179)
* **Gap:** Row-Level Security (RLS) is enabled on the new hierarchy tables (`organisations`, `institutions`, `academic_years`, `programmes`, `batches`), but **no user/tenant-level policies exist**. The only policy defined is `svc_all_*` for `TO service_role USING (true)`.
* **Impact:** 
  * Any client-side queries using the user's Supabase JWT key will be completely blocked.
  * The application is forced to rely entirely on programmatic isolation checks inside backend API endpoints using the bypass client `supabaseAdmin`.
  * If a developer uses a user-bound client in the future on these tables, it will fail silently (returning 0 rows).

### 🚨 Missing Multi-Campus Management & Switcher UI
* **Code Location:** [owner-auth.ts:L44-L65](file:///c:/Users/ADMIN/School-OS/lib/owner-auth.ts#L44-L65), [app/owner/page.tsx](file:///c:/Users/ADMIN/School-OS/app/owner/page.tsx)
* **Gap:** While the database schema supports multiple institutions under a parent organisation (`institutions.organisation_id`), the Owner Dashboard session helper resolves a single active `institution_id` from the session. The dashboard only queries and displays schools under that single active institution.
* **Impact:** Owners cannot switch between different campuses or institutions in the UI, nor is there any UI to create new institutions (even though the V2 API endpoint allows it for the `owner` role). This makes multi-campus trust operations impossible without manual super-admin intervention.

### 🚨 Static Billing Page (Self-Serve Upgrade Disabled)
* **Code Location:** [app/billing/page.tsx:L7-L12](file:///c:/Users/ADMIN/School-OS/app/billing/page.tsx#L7-L12)
* **Gap:** Although Razorpay order creation and webhook handlers exist in the backend (`app/api/billing/`), the `/billing` page is a static warning card instructing the owner to email support (`support@pranixailabs.com`).
* **Impact:** Owners cannot self-serve upgrade or pay invoices in the UI.

---

## 12-Point Detailed Discovery Findings

### 1. Multiple Institutions under One Owner
* **Support:** **NO** (Database schema allows it, but Owner Context does not).
* **Evidence:** The session helper `requireOwnerSession` ([owner-auth.ts:L44-L65](file:///c:/Users/ADMIN/School-OS/lib/owner-auth.ts#L44-L65)) is designed to resolve a single `institution_id` linked to the active school in the owner's session. The owner context then queries and returns only the schools belonging to that single `institution_id`. There is no mechanism in the owner dashboard or APIs to load or aggregate data from multiple distinct institutions.

### 2. Multiple Campuses
* **Support:** **PARTIAL** (Database schema supports it, but Owner Dashboard does not).
* **Evidence:** Multiple campuses can be defined as separate `institutions` referencing the same `organisation_id`. However, the Owner Dashboard UI ([app/owner/page.tsx](file:///c:/Users/ADMIN/School-OS/app/owner/page.tsx)) and owner-scoped APIs (`/api/owner/dashboard` and `/api/owner/financials`) are strictly hard-coded to aggregate across schools belonging to the resolved session `institution_id`. The owner cannot view or manage multiple campuses from the dashboard.

### 3. Branch Management
* **Support:** **YES**.
* **Evidence:** Within a single `institution` (campus), the owner can manage multiple `schools` (representing departments or branches, e.g., Primary School, High School) linked by `school.institution_id`. The owner dashboard lists these schools and displays aggregated stats (total students, staff, outstanding fees) across them.

### 4. Institution Switching
* **Support:** **NO**.
* **Evidence:** There is no UI or API route allowing an owner to switch their active `institution_id` in their session cookie. The "School switcher" buttons on the Owner Dashboard ([app/owner/page.tsx:L106-L118](file:///c:/Users/ADMIN/School-OS/app/owner/page.tsx#L106-L118)) only filter the local state array of statistics in the browser.

### 5. Institution Creation
* **Support:** **NO** (API supports it, but UI does not).
* **Evidence:** Although the V2 API `POST /api/v2/institutions` ([app/api/v2/institutions/route.ts:L78](file:///c:/Users/ADMIN/School-OS/app/api/v2/institutions/route.ts#L78)) allows users with the `owner` role to insert new institutions, there is no UI component in the application allowing an owner to trigger this.

### 6. Institution Deletion
* **Support:** **NO**.
* **Evidence:** No institution deletion handler or API exists in the codebase. The `[id]` route ([app/api/v2/institutions/[id]/route.ts](file:///c:/Users/ADMIN/School-OS/app/api/v2/institutions/[id]/route.ts)) only implements a `GET` handler. There is no `DELETE` method or UI trigger.

### 7. Delegation
* **Support:** **PARTIAL**.
* **Evidence:** An owner can invite other staff members (e.g. Principal, Admin Staff, Accountant) to manage their school. However, they cannot delegate or grant another user `owner` access. The staff creation endpoint ([app/api/admin/staff/route.ts:L57-L58](file:///c:/Users/ADMIN/School-OS/app/api/admin/staff/route.ts#L57-L58)) restricts `VALID_ROLES` to non-owner roles (excluding `owner`).

### 8. Subscription Management
* **Support:** **NO** (API supports it, but UI does not).
* **Evidence:** The settings endpoint ([app/api/owner/schools/[school_id]/settings/route.ts](file:///c:/Users/ADMIN/School-OS/app/api/owner/schools/[school_id]/settings/route.ts)) allows patching `feature_flags` but does not expose any mechanism to change the subscription plan.

### 9. Billing
* **Support:** **NO** (Backend order creation exists, but UI is disabled).
* **Evidence:** While backend routes for Razorpay order creation (`/api/billing/create-order`) and webhook capture (`/api/billing/webhook`) are present, the `/billing` page ([app/billing/page.tsx:L7-L12](file:///c:/Users/ADMIN/School-OS/app/billing/page.tsx#L7-L12)) is a static card informing owners that billing is handled manually via email.

### 10. Reports Across Institutions
* **Support:** **NO**.
* **Evidence:** All owner dashboard reports and financial APIs (e.g., `/api/owner/financials`) scope queries strictly to the `schoolIds` array resolved from the owner's active `institution_id` session.

### 11. Cross-Institution Analytics
* **Support:** **NO**.
* **Evidence:** Analytics pages and queries do not support aggregating or comparing data across distinct institutions.

### 12. Institution Isolation
* **Support:** **YES** (Enforced programmatically on API routes and via tenant filters on transactional tables, but has RLS gaps).
* **Evidence:** 
  * RLS is enabled on `organisations` and `institutions` ([20260505_phase1_hierarchy.sql:L162-L163](file:///c:/Users/ADMIN/School-OS/supabase/migrations/20260505_phase1_hierarchy.sql#L162-L163)) but only has a policy for `service_role`.
  * Isolation is enforced programmatically in the V2 API by validating that the institution's `organisation_id` matches the caller's session `organisation_id` ([app/api/v2/institutions/[id]/route.ts:L45](file:///c:/Users/ADMIN/School-OS/app/api/v2/institutions/[id]/route.ts#L45)).
  * For core transactional tables, RLS policies (in [20260629130000_fix_cross_tenant_rls_sec_w0_12.sql](file:///c:/Users/ADMIN/School-OS/supabase/migrations/20260629130000_fix_cross_tenant_rls_sec_w0_12.sql)) isolate data at the `school_id` level using user membership checks in `school_users`.
