# API Map

## 1. Authentication APIs
Endpoint paths and methods for authenticating staff, parent, student, and vendor sessions.

* **Staff Auth:**
  * `GET /api/auth/me` - Resolves the current authenticated staff/admin session info.
  * `POST /api/auth/otp/request` - Triggers an OTP code generation for a staff user.
  * `POST /api/auth/otp/reset` - Allows resetting password using an active OTP token.
  * `POST /api/auth/otp/verify` - Verifies the generated OTP.
  * `GET/POST/DELETE /api/auth/session` - Issues, refreshes, or terminates `school_session` cookie.
  * `POST /api/auth/staff/activate/request` - Requests activation credentials for new staff members.
  * `POST /api/auth/staff/activate/verify` - Verifies staff activation and sets up password.

* **Parent Auth:**
  * `POST /api/parent/login` - Authenticates parent using phone number and PIN. Sets `parent_session` cookie.
  * `POST /api/parent/logout` - Revokes session and clears the parent session cookie.
  * `POST /api/parent/login-otp/request` - Requests an OTP code for parent login.
  * `POST /api/parent/login-otp/verify` - Verifies OTP and logs in parent.
  * `POST /api/parent/change-pin` - Alters parent access PIN.
  * `POST /api/parent/send-otp` - Outbound verification OTP trigger.
  * `POST /api/parent/verify-otp` - Inbound verification OTP check.

* **Student Auth:**
  * `POST /api/student/login` - Authenticates student using admission number, school ID, and PIN. Sets `student_session`.
  * `POST /api/student/logout` - Revokes session and clears student session cookie.
  * `POST /api/student/login-otp/request` - Requests student login OTP.
  * `POST /api/student/login-otp/verify` - Verifies student login OTP.
  * `POST /api/student/activate/request` - Requests activation code for student portal.
  * `POST /api/student/activate/verify` - Submits activation parameters and sets student PIN.
  * `POST /api/student/change-pin` - Alters student portal access PIN.

* **Vendor Auth:**
  * `POST /api/vendor/login` - Authenticates vendor using portal email and PIN. Sets `vendor_session`.
  * `POST /api/vendor/logout` - Revokes session and clears vendor session cookie.
  * `GET /api/vendor/me` - Resolves current vendor credentials.
  * `POST /api/vendor/activate/request` - Vendor account activation code request.
  * `POST /api/vendor/activate/verify` - Verifies vendor activation and PIN.
  * `POST /api/vendor/change-pin` - Alters vendor portal access PIN.

---

## 2. Parent Dashboard APIs
* `GET /api/parent/dashboard` - Summarizes student count, details, and notification count.
* `GET /api/parent/student` - Resolves child demographic profile.
* `GET /api/parent/attendance` - Monthly attendance metrics.
* `GET /api/parent/marks` - Exam and report card grades.
* `GET /api/parent/timetable` - Timetable schedule.
* `GET /api/parent/curriculum` - Syllabus progress and assignments.
* `GET /api/parent/homework` - Assigned homework assignments and statuses.
* `GET /api/parent/lesson-plans` - Daily classroom coverage notices.
* `GET /api/parent/notices` - School notice board alerts.
* `GET /api/parent/events` & `GET /api/parent/events/[id]` - Calendar events.
* `GET/POST /api/parent/complaints` - Submits grievances or checks progress.
* `GET/POST /api/parent/consent` - Captures signatures for excursions, policies, or ICDS.
* `GET /api/parent/health` - Medical checkup history.
* `GET /api/parent/transport` - GPS and bus route tracking info.
* `GET /api/parent/vendors` - Book and uniform store integrations.
* `POST /api/parent/vidya-grid/subscribe` - Purchases VidyaGrid subscriptions.
* **Parent Payments & Financials:**
  * `GET /api/parent/fees` - Outstanding fee invoices.
  * `GET /api/parent/fees/activity` - History of payments.
  * `POST /api/parent/fees/create-order` - Prepares a Razorpay transaction order.
  * `POST /api/parent/fees/confirm-payment` - Verifies Razorpay signatures.
  * `GET /api/parent/fees/receipt` - Downloads payment receipts.
  * `POST /api/parent/fees/[id]/submit-payment-proof` - Uploads bank transfer slips.
  * `GET /api/parent/payment-modes` - Active payment gateways.

---

## 3. Student APIs
* `GET /api/student/profile` - Resolves student records.
* `GET /api/student/attendance` - Personal attendance metrics.
* `GET /api/student/marks` - Academic marks history.
* `GET /api/student/timetable` - Daily timetable structure.
* `GET /api/student/curriculum` - Curriculum tracking.
* `GET /api/student/homework` - Lists current homework assignments.
* `POST /api/student/homework/submit` - Submits files and text answers for grading.

---

## 4. Teacher APIs
* `GET /api/teacher/me` - Resolves teacher profile.
* `GET /api/teacher/dashboard` - Tasks, missing attendance warnings, and PTM slots.
* `GET /api/teacher/students` - Class directories.
* `GET /api/teacher/classes` - Assigned sections.
* `GET /api/teacher/schedule` - Weekly teaching periods.
* `GET /api/teacher/attendance` - Sections attendance list.
* `POST /api/teacher/attendance/mark` - Saves daily student attendance.
* `POST /api/teacher/check-in` & `/api/teacher/checkin` - Records clock-in events.
* `POST /api/teacher/geo-checkin` - Verifies location before saving clock-in.
* `GET/POST /api/teacher/meal-attendance` - Logs midday meal consumption.
* `GET/POST /api/teacher/marks` - Uploads class grades.
* `GET/POST /api/teacher/leave` - Submits leaves.
* `GET/POST /api/teacher/proofs` - Classroom video/image proof logs.
* `POST /api/teacher/classroom-proof/upload-url` - Generates a secure S3/GCS upload URL.
* `POST /api/teacher/classroom-proof/confirm` - Commits the file metadata to database.
* **Homework Management:**
  * `GET /api/teacher/homework/list` - Retrieves homeworks.
  * `POST /api/teacher/homework/create` - Publishes a new assignment.
  * `GET /api/teacher/homework/submissions` - Submissions by students.
  * `POST /api/teacher/homework/grade` - Submits grades.
  * `GET/PUT/DELETE /api/teacher/homework/[id]` - Read/Update/Delete single homework.
* **Lesson Planning & Reporting:**
  * `GET /api/teacher/lesson-plans` - Teacher's schedules.
  * `GET /api/teacher/lesson-plans/list` - Retrieves drafts.
  * `POST /api/teacher/lesson-plans/upsert` - Submits lesson plans.
  * `GET/POST /api/teacher/report-narratives` - Compiles descriptive report card text.
  * `POST /api/teacher/report-narratives/generate` - Invokes Claude to generate report narrative.
* **Substitution Alerts:**
  * `GET /api/teacher/substitute/my-assignments` - Substitution alerts.
  * `POST /api/teacher/substitute/respond` - Accepts or declines substitution request.
  * `GET /api/teacher/substitute-today` - Quick list of coverage periods.

---

## 5. Principal APIs
* `GET /api/principal/dashboard` - School status, fees collected, risk flags.
* `GET /api/principal/admissions-pipeline` - Admission inquiries.
* `GET /api/principal/teacher-presence` - Real-time clock-ins.
* `POST /api/principal/geofence/define` - Configures school coordinate geofences.
* `GET /api/principal/geofence/get` - Resolves school geofences.
* `GET/POST /api/principal/leave-approvals` - Approves/Declines teacher leaves.
* `GET /api/principal/substitute/list-needed` - Unassigned periods due to absent teachers.
* `POST /api/principal/substitute/assign` - Dispatches substitution request to free teachers.
* `GET /api/principal/lesson-plans/coverage` - Syllabus tracking.
* `GET /api/principal/report-narratives` - List of narrative report drafts.
* `POST /api/principal/report-narratives/[id]/approve` - Finalizes narrative reviews.
* `GET/POST /api/principal/tc-queue` - Transfer Certificate requests.
* `GET /api/principal/academic-year-promotion/preview` - Simulates class promotion.
* `POST /api/principal/academic-year-promotion/execute` - Promotes all students to the next grade.
* `GET /api/principal/classroom-proofs` & `GET /api/principal/classroom-proofs/list` - Inspects uploads.
* `GET/POST /api/principal/communications` - Broadcast notifications.

---

## 6. Business, Board, HOD & Audit APIs

* **Owner APIs:**
  * `GET /api/owner/dashboard` - Financial overview across all branches.
  * `GET/POST /api/owner/schools` - Institutional properties.
  * `GET/PUT /api/owner/schools/[school_id]/settings` - Enforces plan limits.
  * `GET /api/owner/financials` - Income reports and expense logs.
  * `GET/POST /api/owner/staff` - Global manager lists.

* **HOD APIs:**
  * `GET /api/hod/dashboard` - Department summary.
  * `GET /api/hod/departments` - Active departments.
  * `GET /api/hod/batches` - Section statistics.
  * `GET /api/hod/staff` - Staff roster.
  * `GET /api/hod/roster` - Course assignments.
  * `GET /api/hod/syllabus` - Syllabus templates.
  * `GET /api/hod/coverage` - Class progress monitoring.
  * `GET /api/hod/performance` - Student average scores.

* **MEO & DEO APIs:**
  * `GET /api/meo/dashboard` - Compliance logs.
  * `GET /api/meo/institutions` - School records.
  * `GET/POST /api/meo/inspections` - Submits compliance inspection scores.
  * `GET/POST /api/meo/action-items` - Remedial actions.
  * `GET /api/deo/dashboard` - District summaries.
  * `GET /api/deo/meos` - Inspector rosters.

* **Billing & Subscriptions:**
  * `POST /api/billing/create-order` - Prepares upgrade invoices.
  * `POST /api/billing/upgrade` - Sets school plans.
  * `POST /api/billing/webhook` - Stripe/Razorpay callback.

* **Data Imports (Data Entry Operator):**
  * `/api/import/academic-years`, `/api/import/students`, `/api/import/parents`, `/api/import/staff`, `/api/import/subjects`, `/api/import/fees`.
  * `POST /api/connectors/import` - CSV and JSON parses.
  * `GET/POST /api/connectors/sheets` - Dynamic updates via Google Sheets.

* **Task Scheduling (Crons):**
  * `/api/cron/run`, `/api/cron/run-school`, `/api/cron/daily`, `/api/cron/keep-alive`.
  * `/api/cron/abuse-monitor`, `/api/cron/abuse-digest`, `/api/cron/webhook-rate-sweep`.
  * `/api/cron/webhook-spam-watch`, `/api/cron/login-anomaly-watch`, `/api/cron/magic-link-reminder`.

* **Webhooks:**
  * `/api/webhooks/razorpay` - Updates fee statuses to `paid`.
  * `/api/webhooks/twilio-status` - Registers notification SMS delivery logs.
  * `/api/webhooks/vidya-grid` - Processes inbound academic event sync.

* **V2 Entity APIs:**
  * `/api/v2/institutions`, `/api/v2/institutions/[id]`, `/api/v2/academic-years`, `/api/v2/programmes`.

* **AI, Voice & Diagnostics:**
  * `POST /api/voice-query` - Parses natural language.
  * `POST /api/voice-companion` - Audio interface.
  * `POST /api/call-analysis/process` - Call audits.
  * `POST /api/risk/detect` - Flagging student risk profiles.
  * `POST /api/teacher-eval/process` & `generate-audio` - Lesson auditing.
  * `GET /api/health`, `/api/config`, `/api/protocol-health`, `/api/protocol-selftest`, `/api/usage/check`.
