# Workflow Map (Living Documentation)

This document consolidates and maps the 10 core operational workflows implemented in School-OS. 

### Why a Consolidated Workflow Map?
We have chosen to consolidate all workflows into a single map rather than splitting them into 10 separate markdown files. This maintains cohesive traceability, allows rapid search/scannability for developers, prevents file fragmentation, and ensures the relationships between shared components (like notifications and auth contexts) are easily visible.

---

## 1. Student Attendance Marking Workflow
* **Entry (Trigger):** Class teacher opens the attendance sheet; selects date, class, and section; inputs student statuses, and submits.
* **Validation & Auth Checks:**
  * Enforces `requireTeacherSession` token check.
  * Date must be YYYY-MM-DD format, defaulting to today.
  * Max 7 days in the past, no future dates allowed.
  * Student IDs must exist in the database and belong to the teacher's school/class.
* **Business Rules & Logic:**
  * Valid statuses are `present`, `absent`, `late`, and `excused`.
  * Upserts attendance records: updates existing records or inserts new ones.
* **DB Tables Affected:**
  * Read: `students`, `parents`, `attendance`
  * Write: `attendance` (upsert), `notifications` (insert)
* **Notifications:**
  * Best-effort: absent/late students trigger an automated `whatsapp` message queue entry in the `notifications` table targeting the parent.
* **Reports & Downstream:**
  * Surfaced on the Principal Dashboard as attendance summary graphs.
  * Aggregated into Mandal compliance scoreboards for Mandal Education Officers.
* **API Calls & UI Screens:**
  * UI Page: [/teacher/attendance](file:///c:/Users/ADMIN/School-OS/app/teacher/page.tsx)
  * API Route: `POST /api/teacher/attendance`
* **Evidence & File Paths:**
  * Logic implementation: [app/api/teacher/attendance/route.ts#L27-L104](file:///c:/Users/ADMIN/School-OS/app/api/teacher/attendance/route.ts#L27-L104)

---

## 2. Homework Assignment & Submission Workflow
* **Entry (Trigger):**
  * **Assignment:** Teacher creates homework, defines subject, class, title, description, and due date.
  * **Submission:** Student views pending homework, uploads response files/notes, and submits.
* **Validation & Auth Checks:**
  * **Assignment:** Requires `requireTeacherSession`. Verifies the teacher is scheduled to teach this class/subject in `timetable` table (prevents IDOR).
  * **Submission:** Requires `requireStudentSession` check.
* **Business Rules & Logic:**
  * **Assignment:** Inserts homework row. Generates parent notification.
  * **Submission:** Upserts homework submission record (handling overlaps via unique constraint `student_id,homework_id`).
* **DB Tables Affected:**
  * Read: `timetable`, `classes`, `students`, `homework`, `homework_submissions`
  * Write: `homework` (insert), `homework_submissions` (upsert), `notifications` (insert)
* **Notifications:**
  * **Assignment:** Triggers `homework_assigned` notification to all parent contacts of the class.
  * **Submission:** Triggers notification to the assigning teacher's dashboard notifying them of the student's submission.
* **Reports & Downstream:**
  * Unsubmitted assignments appear as "overdue" on the student portal.
  * Submissions are graded by the teacher via the grading panel.
* **API Calls & UI Screens:**
  * UI Pages: [/teacher/homework](file:///c:/Users/ADMIN/School-OS/app/teacher/page.tsx), [/student](file:///c:/Users/ADMIN/School-OS/app/student/page.tsx)
  * API Routes: `POST /api/teacher/homework`, `POST /api/student/homework/submit`
* **Evidence & File Paths:**
  * Homework Creation: [app/api/teacher/homework/route.ts#L81-L155](file:///c:/Users/ADMIN/School-OS/app/api/teacher/homework/route.ts#L81-L155)
  * Homework Submission: [app/api/student/homework/submit/route.ts#L7-L62](file:///c:/Users/ADMIN/School-OS/app/api/student/homework/submit/route.ts#L7-L62)

---

## 3. Fee Invoicing & Online Payments Workflow
* **Entry (Trigger):**
  * **Demand Invoicing:** Accountant generates a class-wide fee demand.
  * **Online Payment:** Parent logs in, views pending invoice, and completes payment through Razorpay modal.
* **Validation & Auth Checks:**
  * **Demand:** Requires `requireAdminSession` (with accountant scoping). Checks `fee_module_enabled`.
  * **Payment:** Requires Parent phone+PIN verification. Checks `online_payment_enabled` flag.
  * **Confirmation:** Verifies signature match using `hmac_sha256` hash matching the Vercel env secret key.
* **Business Rules & Logic:**
  * Generates an invoice order via Razorpay API.
  * On signature confirmation, updates status to `paid`, allocates a sequential human-readable receipt number, and logs payment timestamp.
  * Inserts record into `audit_log` tracking who created/adjusted the fee.
* **DB Tables Affected:**
  * Read: `school_config`, `students`, `fees`, `parents`
  * Write: `fees` (upsert), `audit_log` (insert), `notifications` (insert)
* **Notifications:**
  * On payment success, inserts a notification record alerting the school accountant of the payment and receipt ID.
* **Reports & Downstream:**
  * Surfaced on Accountant Ledger screens and exported to Tally spreadsheets.
* **API Calls & UI Screens:**
  * UI Pages: [/accountant/demand](file:///c:/Users/ADMIN/School-OS/app/accountant/demand/page.tsx), [/parent](file:///c:/Users/ADMIN/School-OS/app/parent/page.tsx)
  * API Routes: `POST /api/admin/fees`, `POST /api/parent/fees/create-order`, `POST /api/parent/fees/confirm-payment`
* **Evidence & File Paths:**
  * Demand Invoicing: [app/api/admin/fees/route.ts#L151-L218](file:///c:/Users/ADMIN/School-OS/app/api/admin/fees/route.ts#L151-L218)
  * Order Generation: [app/api/parent/fees/create-order/route.ts#L47-L136](file:///c:/Users/ADMIN/School-OS/app/api/parent/fees/create-order/route.ts#L47-L136)
  * Confirmation Logic: [app/api/parent/fees/confirm-payment/route.ts#L64-L164](file:///c:/Users/ADMIN/School-OS/app/api/parent/fees/confirm-payment/route.ts#L64-L164)

---

## 4. Admissions CRM Inquiry Pipeline Workflow
* **Entry (Trigger):** External parent completes an inquiry form, or admin inputs a walk-in lead.
* **Validation & Auth Checks:**
  * Validates required inputs: `parent_name`, `child_age`, `target_class`, `source`, and `phone`.
* **Business Rules & Logic:**
  * **Rule-Based Scoring:** Assigns base score out of 100 based on source (referral=30, etc.), class age ranges, and sibling links.
  * **AI Adjustment:** Calls Claude AI (`claude-haiku-4-5-20251001`) to analyze notes, adjust score by up to ±10, and write counselor insights.
  * **Priority Assignment:** Map score to priority: High (>=70), Medium (>=40), or Low.
  * Double-writes `institution_id` and `school_id` into the record.
* **DB Tables Affected:**
  * Read: `schools`
  * Write: `inquiries`
* **Notifications:**
  * Sends an instant WhatsApp message to the parent confirming receipt and giving their application ID.
* **Reports & Downstream:**
  * Pipeline visible on Admissions Officer CRM board grouped by priority.
* **API Calls & UI Screens:**
  * UI Page: [/admissions/crm](file:///c:/Users/ADMIN/School-OS/app/admissions/crm/page.tsx)
  * API Route: `POST /api/admissions/create`
* **Evidence & File Paths:**
  * Score Calculation & Claude Call: [app/api/admissions/create/route.ts#L65-L106](file:///c:/Users/ADMIN/School-OS/app/api/admissions/create/route.ts#L65-L106)

---

## 5. Staff Leave Request & Approval Workflow
* **Entry (Trigger):**
  * **Request:** Teacher submits a leave form specifying dates, leave type, and reason.
  * **Approval:** Principal opens leave reviews and selects approve/reject.
* **Validation & Auth Checks:**
  * **Request:** Requires `requireTeacherSession`. Verifies from_date is on or before to_date.
  * **Approval:** Requires Principal, Admin, or Owner session. Verifies request status is `pending` (prevents double approval).
* **Business Rules & Logic:**
  * **Approval Updates:** Updates status to approved/rejected. Sets linked substitute assignments to `confirmed`.
  * **Payroll Adjustments:**
    * If `leave_type === 'unpaid'`: Increments `days_absent`, decrements `days_present`, computes daily salary rate, subtracts deduction from gross salary, and recalculates net salary in `payroll_payslips` for active draft runs.
    * If paid leave: Increments `leave_days_paid`.
    * Re-calculates and updates totals inside `payroll_runs`.
  * **Class Broadcasts:** Creates a notice in `broadcasts` for all parents of the classes taught by this teacher.
* **DB Tables Affected:**
  * Read: `staff`, `payroll_runs`, `payroll_payslips`, `staff_class_assignments`, `students`
  * Write: `teacher_leave_requests` (update), `substitute_assignments` (update), `payroll_payslips` (update), `payroll_runs` (update), `broadcasts` (insert)
* **Notifications:**
  * Sends class-wide WhatsApp alerts to parents notifying them of the leave dates and substitute arrangements.
* **Reports & Downstream:**
  * Payroll runs update automatically. Substitute teacher sees assignment.
* **API Calls & UI Screens:**
  * UI Pages: [/teacher/leave](file:///c:/Users/ADMIN/School-OS/app/teacher/page.tsx), [/principal/leave-approvals](file:///c:/Users/ADMIN/School-OS/app/principal/leave-approvals/page.tsx)
  * API Routes: `POST /api/teacher/leave`, `PATCH /api/admin/leave-approvals`
* **Evidence & File Paths:**
  * Request Submission: [app/api/teacher/leave/route.ts#L84-L149](file:///c:/Users/ADMIN/School-OS/app/api/teacher/leave/route.ts#L84-L149)
  * Approval & Payroll Deductions: [app/api/admin/leave-approvals/route.ts#L50-L232](file:///c:/Users/ADMIN/School-OS/app/api/admin/leave-approvals/route.ts#L50-L232)

---

## 6. Hostel Room Allocation & Checkout Workflow
* **Entry (Trigger):** Warden adds rooms, check-ins a resident, or completes checkout.
* **Validation & Auth Checks:**
  * Requires `requireAdminSession` (gated strictly to `hostel_admin`).
  * Requires action parameters (`add_room`, `allocate`, or `vacate`).
* **Business Rules & Logic:**
  * Checks current room capacity against active check-ins.
  * Allocates room if capacity exists.
  * Updates checkout status and sets checkout date on vacate action.
* **DB Tables Affected:**
  * Read: `schools`, `hostel_rooms`, `hostel_allocations`
  * Write: `hostel_rooms` (insert), `hostel_allocations` (insert/update)
* **Notifications:** None.
* **Reports & Downstream:**
  * Hostel occupancy metrics are updated on the Warden dashboard.
* **API Calls & UI Screens:**
  * UI Page: [/hostel-admin](file:///c:/Users/ADMIN/School-OS/app/hostel-admin/page.tsx)
  * API Route: `POST /api/admin/hostel`
* **Evidence & File Paths:**
  * Logic implementation: [app/api/admin/hostel/route.ts#L58-L106](file:///c:/Users/ADMIN/School-OS/app/api/admin/hostel/route.ts#L58-L106)

---

## 7. Anganwadi Child Growth & Nutritional Tracking Workflow
* **Entry (Trigger):** Anganwadi worker logs growth metrics (height, weight, MUAC) and nutritional status for a preschool child.
* **Validation & Auth Checks:**
  * Checks user session, validates that the child belongs to the worker's Anganwadi center.
  * Weight and student ID are mandatory.
* **Business Rules & Logic:**
  * Inserts the growth metrics into the history log.
  * **SAM Escalation Rule:** If `malnutrition_cat` is logged as `'sam'` (Severe Acute Malnutrition), it automatically triggers an escalation by inserting a `health_incidents` record with type `'illness'` detailing the MUAC/weight and specifying a Nutrition Rehabilitation Center (NRC) supervisor referral.
* **DB Tables Affected:**
  * Read: `students`
  * Write: `child_growth_records` (insert), `health_incidents` (insert for SAM cases)
* **Notifications:** None (system-level escalation only).
* **Reports & Downstream:**
  * Child growth history logs and supervisor health boards.
* **API Calls & UI Screens:**
  * UI Page: [/anganwadi](file:///c:/Users/ADMIN/School-OS/app/anganwadi/page.tsx)
  * API Route: `POST /api/anganwadi/growth`
* **Evidence & File Paths:**
  * Malnutrition escalation logic: [app/api/anganwadi/growth/route.ts#L14-L86](file:///c:/Users/ADMIN/School-OS/app/api/anganwadi/growth/route.ts#L14-L86)

---

## 8. AI-Assisted Report Cards Generation Workflow
* **Entry (Trigger):** Principal selects a class and term, then clicks generate.
* **Validation & Auth Checks:**
  * Requires Principal or Admin session.
  * Requires Claude API key check (`getActiveApiKey`).
* **Business Rules & Logic:**
  * Fetches student list and academic records for the specified term.
  * Computes percentages, letter grades, and promotion status (detained if percentage < 40).
  * Calls Claude AI (`claude-haiku`) to write a professional CBSE report narrative based on the student's grades.
  * Upserts comments into `report_narratives` (draft state).
  * Generates and returns a branded report card PDF using `jsPDF` configured with the school's branding logo, primary colors, tagline, and authorized signature.
* **DB Tables Affected:**
  * Read: `students`, `schools`, `academic_records`, `report_narratives`
  * Write: `report_narratives` (upsert)
* **Notifications:** None.
* **Reports & Downstream:**
  * Downloadable PDF report card.
* **API Calls & UI Screens:**
  * UI Page: [/report-cards](file:///c:/Users/ADMIN/School-OS/app/report-cards/page.tsx)
  * API Routes: `POST /api/report-cards/generate`, `POST /api/admin/report-cards/generate`
* **Evidence & File Paths:**
  * Narrative Upsert: [app/api/report-cards/generate/route.ts#L33-L106](file:///c:/Users/ADMIN/School-OS/app/api/report-cards/generate/route.ts#L33-L106)
  * PDF Render with Branding: [app/api/admin/report-cards/generate/route.ts#L60-L243](file:///c:/Users/ADMIN/School-OS/app/api/admin/report-cards/generate/route.ts#L60-L243)

---

## 9. PTM Slot Scheduling Workflow
* **Entry (Trigger):** Principal/Admin creates a Parent Teacher Meeting event.
* **Validation & Auth Checks:**
  * Validates session. Requires meeting date to be today or in the future.
  * Requires end time to be after start time.
* **Business Rules & Logic:**
  * Inserts meeting session. Generates meeting slots based on slot duration minutes.
* **DB Tables Affected:**
  * Read: none on write, joins `ptm_slots` on read.
  * Write: `ptm_sessions` (insert)
* **Notifications:** None.
* **Reports & Downstream:**
  * Bookable slots appear on parent portal.
* **API Calls & UI Screens:**
  * UI Page: [/principal](file:///c:/Users/ADMIN/School-OS/app/principal/page.tsx)
  * API Route: `POST /api/admin/ptm`
* **Evidence & File Paths:**
  * Logic implementation: [app/api/admin/ptm/route.ts#L62-L102](file:///c:/Users/ADMIN/School-OS/app/api/admin/ptm/route.ts#L62-L102)

---

## 10. Transport Assignment Workflow
* **Entry (Trigger):** Admin assigns a student to a specific bus route and stop.
* **Validation & Auth Checks:**
  * Requires Admin session. Required fields: `student_id`, `route_id`.
* **Business Rules & Logic:**
  * Upserts the transport record: updates active assignments or inserts a new route allocation, setting `opted_in` to true.
* **DB Tables Affected:**
  * Read: none on write, joins `students`, `transport_routes`, `transport_stops` on read.
  * Write: `student_transport` (upsert)
* **Notifications:** None.
* **Reports & Downstream:**
  * Transport tracking page on parent portal.
* **API Calls & UI Screens:**
  * UI Page: [/admin/transport](file:///c:/Users/ADMIN/School-OS/app/admin/page.tsx)
  * API Route: `POST /api/admin/transport/students`
* **Evidence & File Paths:**
  * Logic implementation: [app/api/admin/transport/students/route.ts#L49-L77](file:///c:/Users/ADMIN/School-OS/app/api/admin/transport/students/route.ts#L49-L77)
