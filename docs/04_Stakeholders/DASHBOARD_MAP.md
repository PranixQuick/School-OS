# Dashboard Map

This document provides a comprehensive mapping of every dashboard and landing page accessible by each stakeholder role in School-OS. It outlines the menus, widgets, and reachable paths (including hidden or unlinked pages), citing the file locations and codebase gating logic.

---

## 1. Navigational Architecture & Gating

### Sidebar Engine
* **File:** [components/Layout.tsx](file:///c:/Users/ADMIN/School-OS/components/Layout.tsx)
* **Configuration:** Defined via the `NAV_BY_ROLE` mapping (lines 75–361).
* **Role Mappings:** Mappings are resolved dynamically in `resolveNavRole` (lines 370-376). An `admin` user at an `anganwadi` institution type is mapped to the `anganwadi_admin` navigation layouts.
* **Global Search Access:** The global search bar (lines 485–492) is restricted to the following roles: `owner`, `principal`, `admin`, `admin_staff`, `viewer`, and `counsellor`.

### Session & Guard Mechanics
* **Session Validation:** Enforced in `middleware.ts` by checking for the `school_session` cookie on all non-public routes.
* **Administrative Operations Gate:** Enforced via `requireAdminSession` in [lib/admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L32-L84). Allowed roles include:
  ```typescript
  const ALLOWED_ROLES = new Set([
    'owner', 'principal', 'admin_staff', 'admin',
    'accountant', 'viewer', 'counsellor',
  ]);
  ```
* **Viewer Restrictions:** Users with the `viewer` role are restricted to read-only actions (only `GET` requests are allowed; mutations via `POST`/`PUT`/`PATCH`/`DELETE` return 403 Forbidden).
* **Accountant Scoping:** Accountants are restricted to fee-domain routes defined in `canAccountantAccess()` from [lib/authz.ts](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L91-L95). Any other admin route returns a 403 Forbidden.
* **Super-Admin Authorization:** Gated via the email domain check `requireSuperAdmin` in [lib/super-admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/super-admin-auth.ts#L16-L22) (restricts access to email addresses ending with `@pranixailabs.com`).

---

## 2. Dashboard Map by Stakeholder Role

### STK-001: Owner
* **Landing Page / Main Dashboard:** [/owner](file:///c:/Users/ADMIN/School-OS/app/owner/page.tsx)
* **Reachable Subpages / Views:**
  * **Multi-Institution Panel:** Displays aggregated metrics across all schools sharing the owner's `institution_id`.
  * **Branch Management Switcher:** Lists and navigates between different branches.
  * **Billing Logs & Invoice History:** Access to payment history and subscription tiers.
  * **Delegates Management:** Console to add and modify delegates.
* **Hidden / Unlinked Pages:**
  * [/admin/settings/branding](file:///c:/Users/ADMIN/School-OS/app/admin/settings/branding/page.tsx) — Branding Profile editor. Uses `/api/admin/schools/branding`. Not linked from the sidebar or general settings page.

---

### STK-002: Principal
* **Landing Page / Main Dashboard:** [/principal](file:///c:/Users/ADMIN/School-OS/app/principal/page.tsx)
* **Reachable Subpages / Views:**
  * **Leave Approvals Console:** [/principal/leave-approvals](file:///c:/Users/ADMIN/School-OS/app/principal/leave-approvals/page.tsx) — Approve or reject leave requests from teachers/staff.
  * **Student Roster:** [/students](file:///c:/Users/ADMIN/School-OS/app/students/page.tsx)
  * **Staff Management:** [/admin/staff](file:///c:/Users/ADMIN/School-OS/app/admin/staff/page.tsx)
  * **Complaints Registry:** [/admin/complaints](file:///c:/Users/ADMIN/School-OS/app/admin/complaints/page.tsx)
  * **Health Incidents:** [/admin/health-incidents](file:///c:/Users/ADMIN/School-OS/app/admin/health-incidents/page.tsx)
  * **Promotion Registry:** [/admin/promotion](file:///c:/Users/ADMIN/School-OS/app/admin/promotion/page.tsx)
  * **Teacher Evaluations:** [/teacher-eval](file:///c:/Users/ADMIN/School-OS/app/teacher-eval/page.tsx)
  * **Report Cards Console:** [/report-cards](file:///c:/Users/ADMIN/School-OS/app/report-cards/page.tsx)
  * **Coming Soon Analytics:** [/analytics](file:///c:/Users/ADMIN/School-OS/app/analytics/page.tsx)
  * **Settings:** [/settings](file:///c:/Users/ADMIN/School-OS/app/settings/page.tsx)

---

### STK-003: Admin Staff
* **Landing Page / Main Dashboard:** [/dashboard](file:///c:/Users/ADMIN/School-OS/app/dashboard/page.tsx)
* **Reachable Subpages / Views:**
  * **Student Roster:** [/students](file:///c:/Users/ADMIN/School-OS/app/students/page.tsx)
  * **Staff Directory:** [/admin/staff](file:///c:/Users/ADMIN/School-OS/app/admin/staff/page.tsx)
  * **Fees Management:** [/admin/fees](file:///c:/Users/ADMIN/School-OS/app/admin/fees/page.tsx) & [/admin/fees/categories](file:///c:/Users/ADMIN/School-OS/app/admin/fees/categories/page.tsx)
  * **Admissions Funnel / Leads CRM:** [/admissions](file:///c:/Users/ADMIN/School-OS/app/admissions/page.tsx) & [/admissions/crm](file:///c:/Users/ADMIN/School-OS/app/admissions/crm/page.tsx)
  * **Bulk CSV Importer:** [/admin/import](file:///c:/Users/ADMIN/School-OS/app/admin/import/page.tsx)
  * **Teacher Evaluations:** [/teacher-eval](file:///c:/Users/ADMIN/School-OS/app/teacher-eval/page.tsx)
  * **Report Cards Console:** [/report-cards](file:///c:/Users/ADMIN/School-OS/app/report-cards/page.tsx)
  * **Coming Soon Analytics:** [/analytics](file:///c:/Users/ADMIN/School-OS/app/analytics/page.tsx)
  * **Settings:** [/settings](file:///c:/Users/ADMIN/School-OS/app/settings/page.tsx)

---

### STK-004: Teacher
* **Landing Page / Main Dashboard:** [/teacher](file:///c:/Users/ADMIN/School-OS/app/teacher/page.tsx) (or drawer layout at [app/teacher/layout.tsx](file:///c:/Users/ADMIN/School-OS/app/teacher/layout.tsx))
* **Reachable Subpages / Views:**
  * **Check-In Console:** [/teacher/check-in](file:///c:/Users/ADMIN/School-OS/app/teacher/check-in/page.tsx)
  * **Attendance Marking:** [/teacher/attendance](file:///c:/Users/ADMIN/School-OS/app/teacher/attendance/page.tsx)
  * **Homework Board:** [/teacher/homework](file:///c:/Users/ADMIN/School-OS/app/teacher/homework/page.tsx)
  * **Marks & Grades Entry:** [/teacher/marks](file:///c:/Users/ADMIN/School-OS/app/teacher/marks/page.tsx)
  * **Timetable & Lesson Plans:** [/teacher/lesson-plans](file:///c:/Users/ADMIN/School-OS/app/teacher/lesson-plans/page.tsx)
  * **Midday Meal Attendance:** [/teacher/meal-attendance](file:///c:/Users/ADMIN/School-OS/app/teacher/meal-attendance/page.tsx)
  * **Leave Application:** [/teacher/leave](file:///c:/Users/ADMIN/School-OS/app/teacher/leave/page.tsx)
* **Hidden / Unlinked Pages:**
  * [/teacher/checkin](file:///c:/Users/ADMIN/School-OS/app/teacher/checkin/page.tsx) — Duplicate routing path that redirects to the canonical `/teacher/check-in`.

---

### STK-005: Head of Department (HOD)
* **Landing Page / Main Dashboard:** [/hod/dashboard](file:///c:/Users/ADMIN/School-OS/app/hod/dashboard/page.tsx)
* **Reachable Subpages / Views:**
  * **Student Registry:** [/students](file:///c:/Users/ADMIN/School-OS/app/students/page.tsx)
  * **Assessments:** [/admin/assessments](file:///c:/Users/ADMIN/School-OS/app/admin/assessments/page.tsx)
  * **Internships:** [/admin/internships](file:///c:/Users/ADMIN/School-OS/app/admin/internships/page.tsx)
  * **Placement:** [/admin/placement](file:///c:/Users/ADMIN/School-OS/app/admin/placement/page.tsx)
  * **Accreditation Tracker:** [/admin/accreditation](file:///c:/Users/ADMIN/School-OS/app/admin/accreditation/page.tsx)
  * **Settings:** [/settings](file:///c:/Users/ADMIN/School-OS/app/settings/page.tsx)

---

### STK-006: Accountant
* **Landing Page / Main Dashboard:** [/accountant](file:///c:/Users/ADMIN/School-OS/app/accountant/page.tsx)
* **Reachable Subpages / Views:**
  * **Fee Collections Dashboard:** Display collections by cash, online, and bank transfer.
  * **Generate Demands:** [/accountant/demand](file:///c:/Users/ADMIN/School-OS/app/accountant/demand/page.tsx)
  * **Student Ledgers:** [/accountant/ledger](file:///c:/Users/ADMIN/School-OS/app/accountant/ledger/page.tsx)
  * **Defaulters Report:** [/accountant/defaulters](file:///c:/Users/ADMIN/School-OS/app/accountant/defaulters/page.tsx)
  * **Tally Export Console:** [/accountant/tally](file:///c:/Users/ADMIN/School-OS/app/accountant/tally/page.tsx)
  * **Unified Expenses Log:** Track inward/outward office expenses and government supplies.
  * **Fee Management:** [/admin/fees](file:///c:/Users/ADMIN/School-OS/app/admin/fees/page.tsx) & [/admin/fees/categories](file:///c:/Users/ADMIN/School-OS/app/admin/fees/categories/page.tsx)
* **Gating note:** Accountants are denied access to non-finance routes, enforced via `canAccountantAccess()` from [lib/authz.ts](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L91-L95).

---

### STK-007: Counsellor
* **Landing Page / Main Dashboard:** [/counsellor](file:///c:/Users/ADMIN/School-OS/app/counsellor/page.tsx)
* **Reachable Subpages / Views:**
  * **At-Risk Students List:** Displays AI-generated flags for grades, fee overdue, and attendance shortages.
  * **Follow-up Reminders:** Schedule and log counselling sessions.
  * **Recent Sessions List:** History of student wellbeing sessions.
  * **Student Registry:** [/students](file:///c:/Users/ADMIN/School-OS/app/students/page.tsx)
* **Hidden / Unlinked Pages:**
  * [/admissions/call-analysis](file:///c:/Users/ADMIN/School-OS/app/admissions/call-analysis/page.tsx) — Counsellor scoring dashboard for class recordings. No navigation links exist.

---

### STK-008: Student
* **Landing Page / Main Dashboard:** [/student](file:///c:/Users/ADMIN/School-OS/app/student/page.tsx)
* **Reachable Subpages / Views:**
  * **Attendance Logs:** [/student/attendance](file:///c:/Users/ADMIN/School-OS/app/student/attendance/page.tsx)
  * **Marks & Grades Report:** [/student/marks](file:///c:/Users/ADMIN/School-OS/app/student/marks/page.tsx)
  * **Weekly Class Timetable:** [/student/timetable](file:///c:/Users/ADMIN/School-OS/app/student/timetable/page.tsx)
  * **Homework Submissions:** [/student/homework](file:///c:/Users/ADMIN/School-OS/app/student/homework/page.tsx)
  * **Security Settings (PIN):** [/student/security](file:///c:/Users/ADMIN/School-OS/app/student/security/page.tsx)
* **Hidden / Unlinked Pages:**
  * [/student/activate](file:///c:/Users/ADMIN/School-OS/app/student/activate/page.tsx) — Portal activation flow. Only accessible during first-time login PIN setups.

---

### STK-009: Parent
* **Landing Page / Main Dashboard:** [/parent](file:///c:/Users/ADMIN/School-OS/app/parent/page.tsx)
* **Reachable Subpages / Views:**
  * **Attendance Roster:** Detailed attendance metrics.
  * **Report Card:** Displays term exams and overall grades.
  * **Fee Invoices:** Active fee category bills and online payment processing.
  * **Homework Feed:** Current home assignments.
  * **Security (PIN change):** [/parent/security](file:///c:/Users/ADMIN/School-OS/app/parent/security/page.tsx)
* **Hidden / Unlinked Pages:**
  * [/parent/consent](file:///c:/Users/ADMIN/School-OS/app/parent/consent/page.tsx) — Toggles for DPDP data processing and WhatsApp communications consent. Not linked from the parent portal dashboard.
  * [/parent/vidya-grid/upgrade](file:///c:/Users/ADMIN/School-OS/app/parent/vidya-grid/upgrade/page.tsx) — Adaptive learning plan upgrade and billing screen. Not linked from parent portal dashboard.

---

### STK-010: Vendor
* **Landing Page / Main Dashboard:** [/vendor](file:///c:/Users/ADMIN/School-OS/app/vendor/page.tsx)
* **Reachable Subpages / Views:**
  * **Profile Details:** Mapped to the `vendors` DB schema (GST, contract date, address).
  * **Contact Details (Editable):** Update contact name, email, and phone number.
  * **PIN Management:** [/vendor/security](file:///c:/Users/ADMIN/School-OS/app/vendor/security/page.tsx)
* **Hidden / Unlinked Pages:**
  * [/vendor/activate](file:///c:/Users/ADMIN/School-OS/app/vendor/activate/page.tsx) — Activation PIN flow.

---

### STK-011: Mandal Education Officer (MEO)
* **Landing Page / Main Dashboard:** [/meo/dashboard](file:///c:/Users/ADMIN/School-OS/app/meo/dashboard/page.tsx)
* **Reachable Subpages / Views:**
  * **Compliance Auditing:** Track UDISE compliance and midday meal shortages.
  * **Risk School Metrics:** Lists institutions requiring immediate intervention.
  * **Field Inspections logging:** [/meo/inspections](file:///c:/Users/ADMIN/School-OS/app/meo/inspections/page.tsx)

---

### STK-012: District Education Officer (DEO)
* **Landing Page / Main Dashboard:** [/deo/dashboard](file:///c:/Users/ADMIN/School-OS/app/deo/dashboard/page.tsx)
* **Reachable Subpages / Views:**
  * **Aggregated Compliance Analytics:** Monitors mandal performance and risk metrics.
  * **MEO Portal View:** [/meo/dashboard](file:///c:/Users/ADMIN/School-OS/app/meo/dashboard/page.tsx)

---

### STK-013: Registrar
* **Landing Page / Main Dashboard:** [/registrar/dashboard](file:///c:/Users/ADMIN/School-OS/app/registrar/dashboard/page.tsx)
* **Reachable Subpages / Views:**
  * **Upcoming Exams & Ongoing Exams List:** Mapped to examination schedules.
  * **Schedule Exam:** [/admin/assessments](file:///c:/Users/ADMIN/School-OS/app/admin/assessments/page.tsx)
  * **Hall Tickets:** [/admin/hall-tickets](file:///c:/Users/ADMIN/School-OS/app/admin/hall-tickets/page.tsx)
  * **Publish Results:** [/admin/results](file:///c:/Users/ADMIN/School-OS/app/admin/results/page.tsx)
  * **Analytics:** [/analytics](file:///c:/Users/ADMIN/School-OS/app/analytics/page.tsx)

---

### STK-014: Librarian
* **Landing Page / Main Dashboard:** [/librarian](file:///c:/Users/ADMIN/School-OS/app/librarian/page.tsx)
* **Reachable Subpages / Views:**
  * **Coming Soon Placeholder:** Features coming in next release (ISBN catalog search, issuance tracking, parents WhatsApp overdue alerts, fine calculations).
* **Navigation Entry Point:** Zero navigation entry points exist (uses `DEFAULT_NAV` fallback). Must be manually reached via direct URL.

---

### STK-015: Hostel Admin
* **Landing Page / Main Dashboard:** [/hostel-admin](file:///c:/Users/ADMIN/School-OS/app/hostel-admin/page.tsx)
* **Reachable Subpages / Views:**
  * **Rooms Status View:** Available beds and block numbers.
  * **Warden Allocation Panel:** Allocate students to beds (requires `student_id` and `room_id`).
  * **Current Residents List:** Active checkin details and checkout toggles.
* **Gating & Auth Defect:** The role `hostel_admin` is **not** included in the `ALLOWED_ROLES` list of `requireAdminSession` in [lib/admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L27-L30). Consequently, any API requests to `/api/admin/hostel` triggered from this dashboard will return a `403 Forbidden` error, blocking room allocation and checkout operations.
* **Navigation Entry Point:** Zero navigation entry points exist (uses `DEFAULT_NAV` fallback). Must be manually reached via direct URL.

---

### STK-016: Anganwadi Worker (AWW)
* **Landing Page / Main Dashboard:** [/anganwadi](file:///c:/Users/ADMIN/School-OS/app/anganwadi/page.tsx) (active when `role === 'admin'` and `isAnganwadi` is true)
* **Reachable Subpages / Views:**
  * **Beneficiary Roster:** [/anganwadi/beneficiaries](file:///c:/Users/ADMIN/School-OS/app/anganwadi/beneficiaries/page.tsx)
  * **Nourishment Growth Log (SAM/MAM):** [/anganwadi/growth](file:///c:/Users/ADMIN/School-OS/app/anganwadi/growth/page.tsx)
  * **Overdue Vaccines Registry:** [/anganwadi/immunization](file:///c:/Users/ADMIN/School-OS/app/anganwadi/immunization/page.tsx)
  * **MDM Inventory Management:** [/anganwadi/mdm-stock](file:///c:/Users/ADMIN/School-OS/app/anganwadi/mdm-stock/page.tsx)
  * **Nutritional Supplement Logs:** [/anganwadi/nutrition](file:///c:/Users/ADMIN/School-OS/app/anganwadi/nutrition/page.tsx)
  * **Daily Attendance:** [/teacher/attendance](file:///c:/Users/ADMIN/School-OS/app/teacher/attendance/page.tsx)
  * **MDM Daily Meal Attendance:** [/teacher/meal-attendance](file:///c:/Users/ADMIN/School-OS/app/teacher/meal-attendance/page.tsx)

---

### STK-017: Super Admin
* **Landing Page / Main Dashboard:** [/super-admin](file:///c:/Users/ADMIN/School-OS/app/super-admin/page.tsx)
* **Reachable Subpages / Views:**
  * **Operational Health Panel:** [/super-admin/ops-dashboard](file:///c:/Users/ADMIN/School-OS/app/super-admin/ops-dashboard/page.tsx) — Displays Redis metrics, background cron status, and email delivery reports.
  * **Adaptive Subscription Plans Grid:** [/super-admin/vidya-grid-plans](file:///c:/Users/ADMIN/School-OS/app/super-admin/vidya-grid-plans/page.tsx)
* **Hidden / Unlinked Pages:**
  * [/admin/role-permissions](file:///c:/Users/ADMIN/School-OS/app/admin/role-permissions/page.tsx) — Global permission matrix editor (gates strictly via `isSuperAdmin` check in `/api/admin/role-permissions`). No navigation link exists.
  * [/admin/nl-ops](file:///c:/Users/ADMIN/School-OS/app/admin/nl-ops/page.tsx) — Natural Language Operations console. No navigation link exists.
  * [/admin/ops](file:///c:/Users/ADMIN/School-OS/app/admin/ops/page.tsx) — Operational cron, Razorpay sync, and notification queue console. No navigation link exists.

---

### STK-018: Viewer
* **Landing Page / Main Dashboard:** [/dashboard](file:///c:/Users/ADMIN/School-OS/app/dashboard/page.tsx)
* **Reachable Subpages / Views:**
  * **Student Roster:** [/students](file:///c:/Users/ADMIN/School-OS/app/students/page.tsx)
  * **Staff Directory:** [/admin/staff](file:///c:/Users/ADMIN/School-OS/app/admin/staff/page.tsx)
  * **Report Cards:** [/report-cards](file:///c:/Users/ADMIN/School-OS/app/report-cards/page.tsx)
  * **Coming Soon Analytics:** [/analytics](file:///c:/Users/ADMIN/School-OS/app/analytics/page.tsx)
  * **Settings:** [/settings](file:///c:/Users/ADMIN/School-OS/app/settings/page.tsx)
* **Gating note:** Users with this role are restricted to `GET` requests on administrative endpoints. Any mutation attempt triggers a 403 Forbidden error.

---

## 3. Discovered Hidden & Unlinked Pages

The following pages exist within the filesystem but have zero navigation entry points or dashboard links. They are reachable only via direct URL manipulation:

| Path | Purpose / Endpoint Used | Stakeholder Scope | Status / Dead Code Check |
|---|---|---|---|
| `/admin/role-permissions` | Policy editor for global permissions table | `super_admin` | Hidden feature. Gated to `@pranixailabs.com` emails. |
| `/admissions/call-analysis` | Counselor transcription evaluator & AI scoring console | `counsellor`, `admin` | Unlinked console page. |
| `/connectors` | ERP API and Google Sheets synchronizer | `admin`, `owner` | Unlinked integration page. |
| `/admin/nl-ops` | Natural Language Query sandbox | `super_admin` | Operational sandbox. |
| `/admin/ops` | Razorpay billing metrics and background cron controller | `super_admin` | Operational console. |
| `/admin/settings/branding` | Custom colors and invoice prefix editor | `owner`, `admin` | Unlinked branding setup page. |
| `/parent/consent` | Consent manager for WhatsApp broadcasts & DPDP regulations | `parent` | Unlinked compliance page. |
| `/parent/vidya-grid/upgrade` | Subscription upgrade panel | `parent` | Unlinked billing page. |
| `/teacher/checkin` | Redirect route to the canonical `/teacher/check-in` | `teacher` | Redirection placeholder (dead path). |
| `/import` | Legacy student CSV bulk importer | `admin` | Legacy page replaced by `/admin/import`. |
| `/automation/classroom-proofs` | Sandbox to check class recording uploads | `admin` | Hidden automation submodule. |
| `/automation/cron` | Mock background worker task triggering | `admin` | Hidden automation submodule. |
| `/automation/fees` | Mock fee payments builder | `admin` | Hidden automation submodule. |
| `/automation/geofence` | Teacher check-in coordinates validation console | `admin` | Hidden automation submodule. |
| `/automation/lesson-plans-coverage` | Academic progress compliance simulator | `admin` | Hidden automation submodule. |
| `/automation/promotion` | Batch academic promotion simulator | `admin` | Hidden automation submodule. |
| `/automation/substitutes` | AI substitute teacher assigner mockup | `admin` | Hidden automation submodule. |
