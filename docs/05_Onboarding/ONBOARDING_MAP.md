# Onboarding Map

This document catalogs every onboarding and institution-creation path implemented in School-OS, mapping how new institutions and schools are created, configured, and activated.

---

## Discovered Onboarding Paths

Based on tracing the codebase, there are exactly **two active onboarding/creation paths** for institutions/schools:

### 1. Self-Registration Portal (Owner Self-Signup)
* **Initiation/Trigger:** Prospective school owners register via the client-side portal [app/register/page.tsx](file:///c:/Users/ADMIN/School-OS/app/register/page.tsx). It is public and accessible without an active session.
* **API Endpoint:** `POST /api/schools/create` handled by [route.ts](file:///c:/Users/ADMIN/School-OS/app/api/schools/create/route.ts).
* **Data Collected:**
  * **School Info:** `school_name`, `board` / `affiliation` (standard boards like CBSE, ICSE, IB, State Board, Cambridge, or higher-ed bodies like UGC, AICTE, NMC), `contact_phone`, `address`, `district`.
  * **Owner Credentials:** `admin_email`, `admin_name`.
  * **Parameters:** `institution_type` (mappings from `school_k10` to `university` or `coaching`), `ownership_type` (`private` | `government` | `aided` | `franchise`).
* **Tables Written To:**
  1. `organisations` - Creates a new management trust 1:1 with the school name and owner's email.
  2. `institutions` - Creates the physical campus entity, resolving feature flags like `fee_module_enabled`, `meal_tracking_enabled`, `rte_mode_enabled`, and `scholarship_tracking_enabled` based on type and ownership.
  3. `schools` - Creates the school tenant record linked to the institution, setting `plan: 'free'` and `is_active: true`.
  4. `auth.users` - Provisions the Supabase Auth user record for the owner, generating a starting password in the format `edprosys[4_chars_of_school_uuid]` and setting `email_confirm: true`.
  5. `school_users` - Creates the administrator mapping: role and `role_v2` set to `'owner'`, `is_active: true`, `invite_status: 'verified'`, `auth_verified: true`, linking them to the auth user.
  6. `owner_profiles` - Creates the billing/plan profile for the owner, default setting `subscription_plan: 'basic'`, `max_schools: 1`.
  7. `events` - Seeds a welcome event in the calendar.
* **Approval/Verification Gate:** No manual administrative approval queue is required. The owner's credentials are created and marked verified immediately so they can log in. However, the school's `onboarded_at` is left `NULL` until they complete the onboarding wizard.

---

### 2. V2 Institutions API (Operational Provisioning)
* **Initiation/Trigger:** Initiated programmatically or via management panels by an existing `owner` or a system `super_admin` (gated via `canManageInstitutions` in [lib/authz.ts](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L24-L26)).
* **API Endpoint:** `POST /api/v2/institutions` handled by [route.ts](file:///c:/Users/ADMIN/School-OS/app/api/v2/institutions/route.ts).
* **Data Collected:**
  * `name`, `slug`, `institution_type` (must be one of: `school_k10`, `school_k12`, `junior_college`, `degree_college`, `engineering`, `mba`, `medical`, `vocational`, `coaching`).
  * Optional: `board`, `affiliation_body`, `address`, `contact_email`, `contact_phone`, `plan`, `settings` (JSON), `feature_flags` (JSON).
  * `organisation_id` (defaults to the caller's organization ID; super-admins may specify a custom ID in the body).
* **Tables Written To:**
  1. `institutions` - Inserts the campus record.
  2. `academic_years` - Auto-creates the starting academic year (e.g. `'2026-27'`) with `is_current: true` and the default term structure.
  3. `programmes` - Auto-creates a default `CBSE_K10` programme (if the type is `school_k10`).
* **Approval/Verification Gate:** Checked strictly via token auth session gates. Created institutions are immediately active (`is_active: true`).

---

## Developer Idempotency Backfills (Developer Only)

* **Script:** [scripts/backfill_institutions.ts](file:///c:/Users/ADMIN/School-OS/scripts/backfill_institutions.ts)
* **Migration:** `supabase/migrations/20260506_phase1_backfill.sql`
* **Mechanism:** Not an onboarding route for new institutions. Instead, it reads existing school rows from the legacy `schools` table and migrates them into the multi-tenant hierarchy (`organisations`, `institutions`, etc.), populating `institution_id` references across actors (students, staff, school_users). Uses `ON CONFLICT DO NOTHING` and `IS NULL` filters for safety.

---

## Constitution Terminology vs. Code Reality Gaps

To maintain strict alignment with *Rule 3 (Document Reality)*, the following discrepancies have been identified between the Constitution's illustrative profiles and the implemented codebase:

1. **Missing Onboarding Flows / Options:**
   * **"Trust" & "Multi-Campus":** No dedicated creation portals or selectable options exist for these types in the signup form. Instead, they are supported *hierarchically* in the database: a user first registers a single school (which creates a parent `organisation`), and then adds more `institutions` under that same `organisation_id` using the V2 API.
   * **"Residential Campus":** Only exists in the registration options under the label `welfare_school` (Welfare / Residential School), which maps to `welfare_school` in the database.
   * **"Intermediate College":** No distinct option exists; junior college registrations use the label `junior_college` (Junior College 11-12 / PUC) in the code.
2. **Missing Trial Plan / Option:**
   * **"Trial":** The Constitution references "Trial" schools, but no such plan option is coded. All self-registrations default strictly to `plan: 'free'` on `schools` and `subscription_plan: 'basic'` on `owner_profiles`.
3. **Unimplemented Option Type:**
   * **"franchise":** Exists solely as an `ownership_type` string option (`private` | `government` | `aided` | `franchise`) in the signup form, mapping to `ownership_type` on `institutions`, but does not trigger a distinct onboarding workflow.

---

## Post-Registration Activation Checklist & Gates

When a school registers via self-signup, it is placed in an inactive setup state (`onboarded_at IS NULL`). The owner is routed to the 10-step onboarding checklist wizard `/onboarding`.

To finalize activation and set `onboarded_at = now()` (which goes live via `POST /api/admin/onboarding/7-activate`), the system enforces the following preconditions:

1. **Staff Count:** Requires at least **1 active staff member** in the `staff` table.
2. **Academic Structure:**
   * **School Types:** Requires at least **1 class** in the `classes` table.
   * **Higher-Ed / Coaching / College Types:** Requires at least **1 batch** in the `batches` table.
   * **Anganwadi / Vocational:** Accepts either classes or batches > 0.
3. **Student Count:** Requires at least **1 active student** in the `students` table.
4. **Subject Count:** Requires at least **1 subject** in the `subjects` table (only enforced for school types).
5. **DPDP Compliance Guard:** Checks via `institution_legal_acceptance_complete` RPC function that the owner has accepted all legal documents marked as `is_current = true` in the `legal_documents` table.
