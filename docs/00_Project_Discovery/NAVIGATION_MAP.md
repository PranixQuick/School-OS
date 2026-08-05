# Navigation Map

## 1. App Router Navigation System
School-OS uses the Next.js App Router. Pages are organized into directories under the `app/` folder, and their file structure maps directly to the URL paths.

## 2. Layouts and Routing
Layout wrapping and styling are structured per role:
* **Root Layout (`app/layout.tsx`):** Provides the global HTML/Body structure.
* **Role Layouts:** Four roles have dedicated, nested layout files (`layout.tsx`) that wrap all sub-pages under their path, providing consistent headers, sidebars, branding logo lookups, help widgets, and logout logic:
  * `app/admin/layout.tsx`
  * `app/parent/layout.tsx`
  * `app/student/layout.tsx`
  * `app/teacher/layout.tsx`
* **Custom Layout Roles:** Other roles (like `principal`, `owner`, `hostel-admin`, `anganwadi`, `counsellor`) do not have sub-layouts and inherit the Root Layout directly. They contain custom navigation panels built inside their specific page components.

---

## 3. Role-Based Route Hierarchy

### A. Parent Portal (`app/parent/`)
* `/parent/login` - PIN login.
* `/parent/login-otp` - OTP verification login.
* `/parent/register` - New parent registration.
* `/parent/` - Main parent dashboard.
* `/parent/attendance` - Child daily presence details.
* `/parent/marks` - Grading reports.
* `/parent/fees` - Invoices and due payments.
* `/parent/fees/receipt` - Print receipts.
* `/parent/homework` - Current assignments.
* `/parent/curriculum` & `/parent/lesson-plans` - Class schedules and progress notes.
* `/parent/events` & `/parent/events/[id]` - School calendar and notices.
* `/parent/complaints` - Grievance logs.
* `/parent/consent` - Activity authorization.
* `/parent/health` - Medical entries.
* `/parent/timetable` - Weekly scheduling.
* `/parent/vendors` - Uniform and book ordering.
* `/parent/vidya-grid/upgrade` - Educational subscription plan.
* `/parent/security` - Credentials settings.

### B. Student Portal (`app/student/`)
* `/student/login` - Login.
* `/student/login-otp` - OTP login.
* `/student/activate` - Portal activation.
* `/student/` - Main student dashboard.
* `/student/attendance` - Attendance logs.
* `/student/marks` - Marks and report cards.
* `/student/timetable` - Class schedule.
* `/student/curriculum` - Syllabus checklists.
* `/student/homework` - Assignment submission portal.
* `/student/security` - PIN modification.

### C. Teacher Portal (`app/teacher/`)
* `/teacher/` - Main teacher dashboard.
* `/teacher/attendance` - Daily roster.
* `/teacher/check-in` & `/teacher/checkin` - Teacher clock-in.
* `/teacher/curriculum` - Syllabus progress checklists.
* `/teacher/homework` & `/teacher/homework/[id]` - Submissions and creation.
* `/teacher/leave` - Leave request form.
* `/teacher/lesson-plans` - Daily schedule and lesson plans.
* `/teacher/marks` - Student marks entry.
* `/teacher/meal-attendance` - Midday meals logging.
* `/teacher/proofs` - Classroom video upload confirmations.

### D. Principal Portal (`app/principal/`)
* `/principal/` - Main dashboard (presence, geofences, fee collections).
* `/principal/leave-approvals` - Teacher leave management.

### E. Owner Portal (`app/owner/`)
* `/` - Landing page redirection.
* `/owner` - Consolidated Multi-Institution Dashboard.

### F. HOD Portal (`app/hod/`)
* `/hod` - HOD landing.
* `/hod/dashboard` - Department and section performance.

### G. Accountant Portal (`app/accountant/` & `app/accounts/`)
* `/accounts` - Accountant dashboard.
* `/accountant/defaulters` - Lists students with unpaid fees.
* `/accountant/demand` - Generates fee demand.
* `/accountant/ledger` - School accounts ledger.
* `/accountant/tally` - Financial statements.

### H. MEO & DEO Inspection Portals (`app/meo/` & `app/deo/`)
* `/meo/dashboard` - Compliance inspector hub.
* `/meo/inspections` - School check and inspection ratings input.
* `/deo/dashboard` - District-level education summaries.

### I. Registrar Dashboard (`app/registrar/`)
* `/registrar/dashboard` - Enrollment numbers.

### J. Vendor Portal (`app/vendor/`)
* `/vendor/login` - Login.
* `/vendor/activate` - Activation PIN setup.
* `/vendor` - Vendor store management.
* `/vendor/security` - Security settings.

### K. Anganwadi Nursery Portal (`app/anganwadi/`)
* `/anganwadi` - Nursery summary dashboard.
* `/anganwadi/beneficiaries` - Children directory.
* `/anganwadi/growth` - Weight and height growth logs.
* `/anganwadi/immunization` - Vaccination alerts.
* `/anganwadi/mdm-stock` - Midday meals provisions stock.
* `/anganwadi/nutrition` - Daily diet logs.

### L. Super Admin Portal (`app/super-admin/`)
* `/super-admin` - Portal hub.
* `/super-admin/ops-dashboard` - System operations.
* `/super-admin/vidya-grid-plans` - Tenant plan limits.

### M. Automation & Developer Tools (`app/automation/`)
* `/automation` - Test dashboards and mock control clients (`briefing`, `broadcasts`, `classroom-proofs`, `cron`, `fees`, `geofence`, `lesson-plans-coverage`, `promotion`, `ptm`, `risk`, `substitutes`, `teacher-attendance`).
