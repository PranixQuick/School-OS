# Database Map

## 1. Database Schema Access (Gap / Blocker Report)

> [!WARNING]
> **Database Inspection Restriction:**
> Real-time database inspection via Supabase live schema tools is currently **blocked** due to the MCP gateway server tool permissions being disabled/inactive (`supabase_list_tables` and `supabase_safe_read_query` returned endpoint-not-enabled errors).
> 
> To bypass this block without guessing, all tables, indices, RLS policies, and relationships have been statically audited directly from the project's **86 database migration files** (`supabase/migrations/`) and backend controller files (`lib/` and `app/api/`).

## 2. Multi-Tenancy & RLS Pattern

School-OS utilizes a tenant-scoped multi-tenancy model:
* **Tenant Identifier:** Almost every core table contains a `school_id` column referencing the school uuid.
* **Row-Level Security (RLS):** Enabled globally on all schema tables. Reading and writing data is gated using Postgres RLS policies checking `school_id = current_school_id()`. 
* **Role Scoping:** Policies also check user roles using `current_user_role() IN ('owner', 'principal', 'admin_staff', 'super_admin')` for writes and updates.
* **Service Role Bypass:** Row-Level Security is skipped entirely when using the `service_role` key. Backend API endpoints initialize a privileged client `supabaseAdmin` with the `SUPABASE_SERVICE_ROLE_KEY` to perform cross-tenant operations (e.g. imports, promotions, global logs, and crons).

---

## 3. Major Table Groups

Based on the migration audit, the tables are organized into six distinct groups:

### A. Auth, Access Control & Safety
* `school_users` - Maps authenticated user emails to `school_id`, `auth_user_id`, and `role_v2` (e.g., `'teacher'`, `'accountant'`, `'principal'`, `'hostel_admin'`).
* `revoked_sessions` - Session denylist checking `user_id` and token issue time (`issued_at`) on logout/revocation.
* `phone_otp` - Stores validation logs and templates for SMS-based parent and student OTP logins.
* `auth_events` - Audit trails logging successful logins, failed attempts, and password changes.
* `alerts` & `blocked_ips` - Stores system abuse alerts, spam logs, and blocked client IPs.
* `webhook_rate_log` - Restricts callback frequency (webhook rate-limiting).

### B. Hierarchy & Organizational Structure
* `organisations` - Represents top-level trusts, franchises, or education chains (unique by `slug`).
* `institutions` - Represents individual schools or campuses (inherits `organisation_id` and links via `legacy_school_id` to legacy `schools` table).
* `academic_years` - Defines years (e.g., `'2026-27'`) and stores JSON structures for school term start/end dates (`term_structure`).
* `programmes` - Defines educational tracks (e.g., `'CBSE_K10'`) and stores grading scales (`grading_schema`).
* `batches` - Represents classes and sections (e.g., Class 5 Section A).
* `staff_hod_scope` - Links HOD users to their departments and campuses to enforce cross-department boundary isolation.

### C. Core Actors
* `schools` - Configuration settings for active schools (name, slug, board, plan, is_active).
* `students` - Student directory containing references to `school_id`, `parent_id`, `academic_year_id`, `admission_number`, `access_pin_hashed`.
* `parents` - Parent accounts containing emails, phone numbers, and active status.
* `staff` - Staff accounts containing employee details, roles, and status.

### D. Academic & Daily Workflows
* `attendance` - Student attendance records (date, status: `'present'`, `'absent'`, `'late'`).
* `teacher_attendance` - Teacher daily attendance check-ins.
* `academic_records` & `student_lifecycle_events` - Academic marks, exam types, and student promotion logs.
* `period_templates` - Standard period configurations (start time, duration) for various school types.
* `timetable` - Weekly schedule grids linking subjects, classrooms, periods, and teachers.
* `ptm_sessions` & `ptm_slots` - Parent-Teacher Meeting schedules and reservations.
* `conversations` - Chat logs and messages between parents, teachers, and administration.
* `recordings` - Speech and lesson audio uploads evaluated by AI feedback modules.
* `student_medical_audit` - Medical histories, check-up logs, and sanitation compliance checks.
* `student_risk_flags` - Tracks students flagged by AI as academic or attendance risks.

### E. Financials & Subscriptions
* `fees` - Student fee due entries (due dates, amounts, status: `'paid'`, `'pending'`, `'overdue'`).
* `fee_categories` - Categories of fees (Tuition, Transport, Uniforms, Books).
* `fee_receipt_counters` - Incremental receipt numbers scoped per school and academic year.
* `payment_transactions` - Ledger recording invoice payments, online orders, and cash collections.
* `payment_allocations` - Matches transactions to fee items.
* `payment_webhook_events` - Transaction callback payloads logged for audit purposes.
* `other_payments` - Tracks operational expenses (rent, inventory, utilities).
* `student_vidya_grid_subscriptions` - Subscriptions to VidyaGrid packages.

### F. Outbound Communication & Outreach
* `notifications` - Dispatch queues for SMS and WhatsApp notifications.
* `broadcasts` - Principal announcements sent to teachers/parents.
* `inquiries` - Lead-tracking tables for prospective admissions.
