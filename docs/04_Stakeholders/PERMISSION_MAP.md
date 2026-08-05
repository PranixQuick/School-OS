# Permission Map

This document provides a comprehensive mapping of every button, action, CRUD operation, approval, export, and upload per role across all 18 stakeholder roles in School-OS. It outlines the codebase files, lines, and database checkpoints enforcing these permissions.

---

## 1. Global Authorization Framework

School-OS governs actions through two main layers:
1. **Middleware and Session Helpers:** Enforces authentication and extracts role claims.
2. **Scoping and Capability Functions:** Enforces action-level permissions and route allowlists inside [lib/authz.ts](file:///c:/Users/ADMIN/School-OS/lib/authz.ts).

### Global Security Helper References
* **Super Admin Verification:** Gated strictly via the email suffix helper `isSuperAdmin` in [lib/authz.ts#L19-L21](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L19-L21).
* **Institution Management Guard:** Gated via `canManageInstitutions` in [lib/authz.ts#L24-L26](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L24-L26). Only the `owner` role or `super_admin` are permitted to provision new institutions.
* **Academic/Operational Gating:** Gated via `canManageAcademicEntities` in [lib/authz.ts#L31-L38](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L31-L38). Only `owner`, `admin`, `admin_staff`, and `super_admin` can create and edit academic entities (years, terms, departments).
* **Accounts/Finance Gating:** Gated via `canManageAccounts` in [lib/authz.ts#L67-L77](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L67-L77). When a school uses a dedicated accountant, access is shared among `accountant`, `admin`, `admin_staff`, `owner`, and `super_admin`. Under admin-only accounting mode, only `admin` / `admin_staff` are permitted.
* **Accountant Scoping Check:** Accountants are restricted to the `ACCOUNTANT_ROUTE_ALLOWLIST` via `canAccountantAccess` in [lib/authz.ts#L91-L95](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L91-L95).
* **Hostel Admin Scoping Check:** Hostel admins are restricted to the `HOSTEL_ADMIN_ROUTE_ALLOWLIST` via `canHostelAdminAccess` in [lib/authz.ts#L106-L110](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L106-L110).

---

## 2. Role-Based Permission Maps (18 Stakeholders)

### STK-001: Owner (`owner`)
* **Core Authority Scope:** Institution-wide management.
* **Interactive Actions & Buttons:**
  * **Switch School:** Switch between schools within the institution hierarchy.
  * **Manage Billing:** View active subscription, invoice histories, and current plans.
  * **Provision Delegates:** Add/remove staff delegates who inherit institution-wide read rights.
  * **Configure School Branding:** Customize colors, upload logos, and set transaction receipt prefixes.
* **Enforcing Backend Code:**
  * Route gating via `requireOwnerSession` in [lib/owner-auth.ts#L34-L38](file:///c:/Users/ADMIN/School-OS/lib/owner-auth.ts#L34-L38).
  * API endpoints: [/api/owner](file:///c:/Users/ADMIN/School-OS/app/api/owner/), [/api/admin/schools/branding](file:///c:/Users/ADMIN/School-OS/app/api/admin/schools/), and [/api/billing](file:///c:/Users/ADMIN/School-OS/app/api/billing/).

---

### STK-002: Principal (`principal`)
* **Core Authority Scope:** School-wide operational management and oversight.
* **Interactive Actions & Buttons:**
  * **Leave Approvals:** One-tap approve / reject leave requests from teachers and staff with optional rejection comments.
    * *Enforced in:* [app/principal/leave-approvals/page.tsx#L81-L97](file:///c:/Users/ADMIN/School-OS/app/principal/leave-approvals/page.tsx#L81-L97) calling `PATCH /api/admin/leave-approvals` (updates `status` and `rejection_reason` in `staff_leaves` table).
  * **Upload Classroom Audio:** Upload audio files for AI-assisted teaching evaluations.
    * *Enforced in:* [app/teacher-eval/page.tsx#L39-L49](file:///c:/Users/ADMIN/School-OS/app/teacher-eval/page.tsx#L39-L49) calling `POST /api/teacher-eval` (inserts into `teacher_evaluations` table).
  * **Generate All Report Cards:** One-click trigger to generate AI-written report narratives for all students.
    * *Enforced in:* [app/report-cards/page.tsx#L28-L37](file:///c:/Users/ADMIN/School-OS/app/report-cards/page.tsx#L28-L37) calling `POST /api/report-cards`.
  * **Resolve Complaints:** Mark parent/student complaints as resolved and input resolution details.
    * *Enforced in:* calls `PATCH /api/admin/complaints` (updates `status` and `resolution_details` in `complaints` table).
  * **Log Health Incidents:** File student first-aid and medical records.
    * *Enforced in:* calls `POST /api/admin/health-incidents` (writes to `health_records`).
* **Enforcing Backend Code:**
  * Route gating via `requirePrincipalSession` in [lib/principal-auth.ts#L42-L49](file:///c:/Users/ADMIN/School-OS/lib/principal-auth.ts#L42-L49).

---

### STK-003: Admin Staff (`admin_staff`)
* **Core Authority Scope:** Full student, staff, and operational management.
* **Interactive Actions & Buttons:**
  * **Student CRUD:** Add student (`POST /api/students`), Edit details (`PATCH /api/students/[id]`), Delete student (`DELETE /api/students/[id]`).
  * **Staff CRUD:** Add staff (`POST /api/admin/staff`), Edit details (`PATCH /api/admin/staff/[id]`), Inactivate staff (`DELETE /api/admin/staff/[id]`).
  * **Parent Association:** Add, edit, or delete parent connections (`POST`/`PATCH`/`DELETE /api/admin/parents`).
  * **Bulk CSV Imports:** Upload formatted student, parent, or staff directories via spreadsheet.
    * *Enforced in:* [app/admin/import/page.tsx#L173-L220](file:///c:/Users/ADMIN/School-OS/app/admin/import/page.tsx#L173-L220) calling endpoints `/api/students`, `/api/admin/staff`, or `/api/admin/parents`.
  * **Admissions Lead Management:** Create lead, edit status, delete lead.
    * *Enforced in:* [app/admissions/crm/page.tsx#L40-L56](file:///c:/Users/ADMIN/School-OS/app/admissions/crm/page.tsx#L40-L56) calling `PATCH` / `DELETE` on `/api/admissions/list` (modifies `leads` table).
  * **Create Fee Structures:** Configure categories (`POST /api/admin/fee-categories`) and templates (`POST /api/admin/fee-templates`).
* **Enforcing Backend Code:**
  * Checked via `requireAdminSession` in [lib/admin-auth.ts#L32-L84](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L32-L84).

---

### STK-004: Teacher (`teacher`)
* **Core Authority Scope:** Classroom management, grading, and presence logging.
* **Interactive Actions & Buttons:**
  * **Clock-in / Clock-out:** Log geofenced physical daily presence.
    * *Enforced in:* [app/teacher/check-in/page.tsx](file:///c:/Users/ADMIN/School-OS/app/teacher/check-in/page.tsx) calling `POST /api/teacher/check-in` (writes to `staff_attendance`).
  * **Mark Student Attendance:** Submit daily class attendance.
    * *Enforced in:* calls `POST /api/teacher/attendance` (writes to `student_attendance` table).
  * **Record Midday Meals:** Log child lunch consumption.
    * *Enforced in:* calls `POST /api/teacher/meal-attendance` (writes to `meal_attendance` table).
  * **Homework Orchestration:** Add homework assignments (`POST /api/teacher/homework`), edit assignments, and grade submissions.
  * **Enter Exam Grades:** Post subject marks for students.
    * *Enforced in:* calls `POST /api/teacher/marks` (writes to `exam_marks` table).
  * **File Leave Request:** Submit medical or casual leave requests.
    * *Enforced in:* calls `POST /api/teacher/leave` (inserts into `staff_leaves` table).
* **Enforcing Backend Code:**
  * Route gating via `requireTeacherSession` in [lib/teacher-auth.ts#L52-L59](file:///c:/Users/ADMIN/School-OS/lib/teacher-auth.ts#L52-L59).

---

### STK-005: Head of Department (HOD) (`hod`)
* **Core Authority Scope:** Departmental analytics and syllabus scheduling.
* **Interactive Actions & Buttons:**
  * **Department Overview:** View loads, teacher details, and student shortages within department scope.
  * **Track Placements, Accreditations, and Internships:** Manage department certifications.
* **Enforcing Backend Code:**
  * Checked in `requireHodSession` from [lib/hod-auth.ts#L12-L19](file:///c:/Users/ADMIN/School-OS/lib/hod-auth.ts#L12-L19) which extracts department scope claims.
  * Denied edit rights on general administrative endpoints (returns 403 Forbidden).

---

### STK-006: Accountant (`accountant`)
* **Core Authority Scope:** Fee collection, accounting, ledger logs, and expenses.
* **Interactive Actions & Buttons:**
  * **Record Payment Collections:** Mark student invoices as paid.
    * *Enforced in:* calls `PATCH /api/admin/fees/[id]` (updates `status` to paid in `student_fees` table).
  * **Generate Fee Demands:** Trigger batch invoicing for classes.
    * *Enforced in:* [app/accountant/demand/page.tsx](file:///c:/Users/ADMIN/School-OS/app/accountant/demand/page.tsx) calling `/api/admin/fees` to bulk insert invoices.
  * **Export Ledgers:** Download Tally-compliant files.
    * *Enforced in:* [app/accountant/tally/page.tsx](file:///c:/Users/ADMIN/School-OS/app/accountant/tally/page.tsx).
  * **Log Transaction Expenses:** Log office outward expenses and inward grants.
    * *Enforced in:* [app/accountant/page.tsx#L85-L116](file:///c:/Users/ADMIN/School-OS/app/accountant/page.tsx#L85-L116) calling `POST /api/admin/expenses` (inserts into `expenses_payments` table).
  * **Approve/Pay Transactions:** Approve pending expenses (only if user has designate credentials) or mark approved as paid.
    * *Enforced in:* [app/accountant/page.tsx#L118-L135](file:///c:/Users/ADMIN/School-OS/app/accountant/page.tsx#L118-L135) calling `PUT /api/admin/expenses/[id]/approve`.
* **Enforcing Backend Code:**
  * accountant role restricted to financial paths via `canAccountantAccess()` from [lib/authz.ts#L91-L95](file:///c:/Users/ADMIN/School-OS/lib/authz.ts#L91-L95).

---

### STK-007: Counsellor (`counsellor`)
* **Core Authority Scope:** Wellbeing monitoring and student session logs.
* **Interactive Actions & Buttons:**
  * **Create Counseling Session Log:** Enter session discussion details.
    * *Enforced in:* [app/counsellor/page.tsx#L41-L54](file:///c:/Users/ADMIN/School-OS/app/counsellor/page.tsx#L41-L54) calling `POST /api/counsellor/sessions` (inserts into `counselling_sessions` table).
  * **Mark Follow-up as Completed:** Close out scheduled student reviews.
    * *Enforced in:* [app/counsellor/page.tsx#L56-L64](file:///c:/Users/ADMIN/School-OS/app/counsellor/page.tsx#L56-L64) calling `PATCH /api/counsellor/sessions` (updates `follow_up_done = true`).
  * **AI Risk Review:** Read-only access to critical flags (attendance drops, average grades, fee delays).
* **Enforcing Backend Code:**
  * Allowed in `requireAdminSession` and verified on counsellor endpoints (`/api/counsellor/...`).

---

### STK-008: Student (`student`)
* **Core Authority Scope:** Coursework submissions and schedule viewing.
* **Interactive Actions & Buttons:**
  * **Submit Homework:** Upload assignments.
    * *Enforced in:* calls `POST /api/student/homework` (inserts into `homework_submissions` table).
  * **Modify Access PIN:** Update login credentials.
    * *Enforced in:* calls `PATCH /api/student/security`.
* **Enforcing Backend Code:**
  * Route gating via `requireStudentSession` in [lib/student-auth.ts#L162-L166](file:///c:/Users/ADMIN/School-OS/lib/student-auth.ts#L162-L166).

---

### STK-009: Parent (`parent`)
* **Core Authority Scope:** Tuition payments, child profile monitoring, and approvals.
* **Interactive Actions & Buttons:**
  * **Pay Fees Online:** Initiates payment order and validates Razorpay signatures.
    * *Enforced in:* calls `POST /api/payments/razorpay/create-order` and `/api/payments/razorpay/verify` (writes status updates to `student_fees` and `payment_logs` tables).
  * **Toggle WhatsApp / DPDP Consent:** Opt-in or opt-out of data-sharing consents.
    * *Enforced in:* [app/parent/consent/page.tsx](file:///c:/Users/ADMIN/School-OS/app/parent/consent/page.tsx) calling `POST /api/parent/consent` (writes to `parent_consent` table).
  * **Modify PIN:** Update credentials.
* **Enforcing Backend Code:**
  * Gated via `getParentSession` in [lib/parent-auth.ts#L87-L92](file:///c:/Users/ADMIN/School-OS/lib/parent-auth.ts#L87-L92).

---

### STK-010: Vendor (`vendor`)
* **Core Authority Scope:** Business details and contact profile updates.
* **Interactive Actions & Buttons:**
  * **Modify Contact Profile:** Edit name, telephone, and email coordinates.
    * *Enforced in:* [app/vendor/page.tsx#L44-L53](file:///c:/Users/ADMIN/School-OS/app/vendor/page.tsx#L44-L53) calling `PATCH /api/vendor/me` (updates `vendors` table).
  * **Modify PIN:** Change vendor credentials (`PATCH /api/vendor/security`).
* **Enforcing Backend Code:**
  * Route gating via `requireVendorSession` in [lib/vendor-auth.ts#L141-L145](file:///c:/Users/ADMIN/School-OS/lib/vendor-auth.ts#L141-L145).

---

### STK-011: Mandal Education Officer (MEO) (`meo`)
* **Core Authority Scope:** Block school compliance and field auditing.
* **Interactive Actions & Buttons:**
  * **Record Field Inspection Report:** Submit evaluation metrics, compliance ratings, and feedback for block schools.
    * *Enforced in:* [app/meo/inspections/page.tsx](file:///c:/Users/ADMIN/School-OS/app/meo/inspections/page.tsx) calling `POST /api/meo/inspections` (writes to `school_inspections` table).
* **Enforcing Backend Code:**
  * Role checked in MEO API routes (validated against `meo_mandal_mapping` linked to their `user_id`).

---

### STK-012: District Education Officer (DEO) (`deo`)
* **Core Authority Scope:** District-wide read-only compliance analysis.
* **Interactive Actions & Buttons:**
  * **Analytical Oversight:** View block compliance graphs, inspection scoreboards, and alert schools lists.
* **Enforcing Backend Code:**
  * Allowed on DEO dashboard API routes (`/api/deo/...`). Has no mutation endpoint access.

---

### STK-013: Registrar (`registrar`)
* **Core Authority Scope:** Enrollment logs and exam coordination.
* **Interactive Actions & Buttons:**
  * **Schedule Examinations:** Create academic exam schedules.
    * *Enforced in:* calls `POST /api/admin/assessments` (writes to `exams` table).
  * **Generate Hall Tickets:** Create student exam attendance logs.
    * *Enforced in:* calls `POST /api/admin/hall-tickets`.
  * **Publish Results:** Lock grades and make results visible to parents.
    * *Enforced in:* calls `POST /api/admin/results` (modifies status in `exam_marks` table).

---

### STK-014: Librarian (`librarian`)
* **Core Authority Scope:** Book listings and issuances (Coming Soon Placeholder).
* **Interactive Actions & Buttons:**
  * **None:** Portal displays planning checklist. Gated to read-only endpoints.

---

### STK-015: Hostel Admin (`hostel_admin`)
* **Core Authority Scope:** Hostel room allocation and resident checkouts.
* **Interactive Actions & Buttons:**
  * **Allocate Student to Room:** Assign a student to a bed.
    * *Enforced in:* [app/hostel-admin/page.tsx#L48-L56](file:///c:/Users/ADMIN/School-OS/app/hostel-admin/page.tsx#L48-L56) calling `POST /api/admin/hostel` with action `allocate` (writes to `hostel_allocations` table).
  * **Checkout Resident:** End room allocation.
    * *Enforced in:* [app/hostel-admin/page.tsx#L58-L61](file:///c:/Users/ADMIN/School-OS/app/hostel-admin/page.tsx#L58-L61) calling `PATCH /api/admin/hostel` with action `checkout` (updates status in `hostel_allocations`).
* **Enforcing Backend Code:**
  * Gated via `requireAdminSession` in [lib/admin-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L32-L84) and restricted to hostel routes via `canHostelAdminAccess`.

---

### STK-016: Anganwadi Worker (AWW) (`aww`)
* **Core Authority Scope:** Preschool nutritional status and vaccine logs.
* **Interactive Actions & Buttons:**
  * **Log Height & Weight Metrics:** Track infant growth.
    * *Enforced in:* calls `POST /api/anganwadi/growth` (writes to `anganwadi_growth_records`).
  * **Log Immunizations:** Record child vaccine completions.
    * *Enforced in:* calls `POST /api/anganwadi/immunization` (writes to `anganwadi_vaccinations`).
  * **Log Supplement Disbursements:** Track distribution of nutritional packets.
    * *Enforced in:* calls `POST /api/anganwadi/nutrition` (writes to `anganwadi_supplements` table).
  * **Log Meal Attendance:** Submit meal headcounts (`POST /api/teacher/meal-attendance`).

---

### STK-017: Super Admin (`super_admin`)
* **Core Authority Scope:** Platform-wide parameters, system health, and configurations.
* **Interactive Actions & Buttons:**
  * **Modify VidyaGrid Subscription Plans:** Configure pricing and threshold configurations.
    * *Enforced in:* calls `POST /api/super-admin/plans` (writes to `vidyagrid_plans` table).
  * **Trigger Operational Actions:** Restart message queues, run database diagnostics, and modify policy arrays.
* **Enforcing Backend Code:**
  * Verified via email domain helper `requireSuperAdmin` in [lib/super-admin-auth.ts#L16-L22](file:///c:/Users/ADMIN/School-OS/lib/super-admin-auth.ts#L16-L22).

---

### STK-018: Viewer (`viewer`)
* **Core Authority Scope:** Read-only access to academic parameters.
* **Interactive Actions & Buttons:**
  * **None (Read-Only):** Gated at the middleware layer. Any non-GET request returns a `403 Forbidden` error.
* **Enforcing Backend Code:**
  * Checked in [lib/admin-auth.ts#L42-L45](file:///c:/Users/ADMIN/School-OS/lib/admin-auth.ts#L42-L45):
    ```typescript
    if (userRole === 'viewer' && req.method !== 'GET') {
      throw new AdminAuthError('Viewer role is read-only', 403);
    }
    ```
