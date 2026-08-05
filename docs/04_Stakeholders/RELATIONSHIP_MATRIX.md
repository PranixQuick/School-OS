# Relationship Matrix

This document maps the relationships between actors (stakeholders) and the core operational events/records in School-OS. It outlines who creates, edits, receives, approves, audits, and reports on each significant event.

---

## 1. Matrix Overview

| Event / Record Type | Creator (Actor) | Editor | Approver | Receiver (Notifications) | Auditor | Reporter (Dashboards) | Downstream Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Student Attendance** | Teacher / AWW | Teacher / AWW | N/A | Parent (WhatsApp) | Principal | Principal / MEO | Parent review |
| **Homework Assigned** | Teacher | Teacher | N/A | Parent / Student | Principal / HOD | Student Portal | Student submits |
| **Homework Submitted** | Student | Student | Teacher | Teacher | Principal / HOD | Teacher Grading | Teacher marks |
| **Fee Invoice Created** | Accountant / Admin | Accountant / Admin | N/A | Parent | Owner / Super Admin | Accountant Ledger | Parent payment |
| **Fee Payment Received** | Parent (Online) / Accountant (Cash) | Accountant | N/A | Accountant (WhatsApp) | Owner / Super Admin | Ledger / Tally | Bank reconciliation |
| **Admissions Inquiry** | External Parent / Admin | Admission Officer | Admission Officer | Parent (WhatsApp) | Principal / Owner | Lead CRM Pipeline | Callbacks & enroll |
| **Leave Requested** | Teacher / Staff | N/A | Principal | Principal | Accountant | Principal Portal | Substitute selection |
| **Leave Approved** | Principal | N/A | Principal | Teacher / Substitute / Parents | Accountant | Activity Log | Payroll & sub work |
| **AI Report Card Narr.** | Principal | Principal | Principal | Parent / Student | Owner | Printed Card PDF | Grade review |
| **Hostel Allocated** | Hostel Admin | Hostel Admin | N/A | N/A | Principal | Occupancy Chart | Resident check-in |
| **PTM Scheduled** | Principal / Admin | Principal / Admin | N/A | Parent / Teacher | Principal | Booking Slots | Slot bookings |
| **Health Incident Logged**| Principal / AWW (SAM cases) | Principal / Admin | N/A | Parent / supervisor | Principal | Incident Log | Hospital/NRC referral |

---

## 2. Event Relationship Details

### Event 1: Student Attendance Marked
* **Creator (Actor):** Teacher (`teacher` via portal check) or Anganwadi Worker (`aww` via preschool meal check).
  * *Code Checkpoint:* Gated by `requireTeacherSession` in [app/api/teacher/attendance/route.ts#L28-L30](file:///c:/Users/ADMIN/School-OS/app/api/teacher/attendance/route.ts#L28-L30).
* **Editor:** Only the creator. Updates occur via conflicts on the unique constraint `attendance_school_student_date_unique`.
  * *Code Checkpoint:* ON CONFLICT updates handled in [app/api/teacher/attendance/route.ts#L61-L76](file:///c:/Users/ADMIN/School-OS/app/api/teacher/attendance/route.ts#L61-L76).
* **Receiver (Notifications):** Parent (`parent`) receives a WhatsApp alert for absent/late statuses.
  * *Code Checkpoint:* Notification record created in [app/api/teacher/attendance/route.ts#L84-L101](file:///c:/Users/ADMIN/School-OS/app/api/teacher/attendance/route.ts#L84-L101).
* **Approver:** N/A.
* **Auditor:** Principal (`principal`) / Mandal Education Officer (`meo`).
* **Reporter:** Surfaced on Teacher class view and Principal dashboard summary charts.
* **Downstream Stakeholder:** Parents (informed of child absence).

---

### Event 2: Homework Assigned
* **Creator:** Teacher (`teacher`).
  * *Code Checkpoint:* Gated by `requireTeacherSession` in [app/api/teacher/homework/route.ts#L82](file:///c:/Users/ADMIN/School-OS/app/api/teacher/homework/route.ts#L82).
* **Editor:** Creator (Teacher).
* **Receiver:** Parent / Student (`parent` / `student`).
  * *Code Checkpoint:* Notification sent to class parent contacts in [app/api/teacher/homework/route.ts#L141-L148](file:///c:/Users/ADMIN/School-OS/app/api/teacher/homework/route.ts#L141-L148).
* **Approver:** N/A.
* **Auditor:** HOD (`hod`) / Principal (`principal`).
* **Reporter:** Listed on the Student Dashboard ("Pending Homework") and Teacher Homework History list.
* **Downstream:** Students (complete and submit assignments).

---

### Event 3: Homework Submitted
* **Creator:** Student (`student`).
  * *Code Checkpoint:* Gated by `requireStudentSession` in [app/api/student/homework/submit/route.ts#L8](file:///c:/Users/ADMIN/School-OS/app/api/student/homework/submit/route.ts#L8).
* **Editor:** Creator (Student). Resubmissions upsert on conflict.
  * *Code Checkpoint:* Upsert handled on unique constraint `student_id,homework_id` in [app/api/student/homework/submit/route.ts#L18-L27](file:///c:/Users/ADMIN/School-OS/app/api/student/homework/submit/route.ts#L18-L27).
* **Receiver:** Teacher (`teacher`).
  * *Code Checkpoint:* Submission notification sent to teacher in [app/api/student/homework/submit/route.ts#L48-L55](file:///c:/Users/ADMIN/School-OS/app/api/student/homework/submit/route.ts#L48-L55).
* **Approver / Grader:** Teacher (`teacher`) reviews, grades, and inserts remarks.
* **Auditor:** HOD (`hod`) / Principal (`principal`).
* **Reporter:** Surfaced on Teacher homework submissions grading view.
* **Downstream:** Teacher (grades the work).

---

### Event 4: Fee Invoice/Demand Generated
* **Creator:** Accountant (`accountant`) or Admin Staff (`admin_staff`).
  * *Code Checkpoint:* Enforced via `requireAdminSession` in [app/api/admin/fees/route.ts#L153](file:///c:/Users/ADMIN/School-OS/app/api/admin/fees/route.ts#L153).
* **Editor:** Accountant (`accountant`), Admin Staff (`admin_staff`), Owner (`owner` - allowed to apply special discounts or waivers).
* **Receiver:** Parent (`parent`) receives the invoice bill on their dashboard portal.
* **Approver:** N/A (discounts must be approved or applied directly by Owner).
* **Auditor:** Owner (`owner`) verifies edits via transaction audit logs.
* **Reporter:** Surfaced on Accountant invoice list and Owner financial summaries.
* **Downstream:** Parents (notified of fee due; pay online).

---

### Event 5: Fee Payment Received (Online/Cash)
* **Creator:** Parent (`parent` - online payments) or Accountant (`accountant` - manual cash receipts).
  * *Code Checkpoint (Online):* Triggers Razorpay signature verification POST in [app/api/parent/fees/confirm-payment/route.ts#L64](file:///c:/Users/ADMIN/School-OS/app/api/parent/fees/confirm-payment/route.ts#L64).
  * *Code Checkpoint (Cash):* Accountant updates status via PATCH in [app/api/admin/fees/[id]/route.ts](file:///c:/Users/ADMIN/School-OS/app/api/admin/fees/).
* **Editor:** Accountant (`accountant`) / Owner (`owner`).
* **Receiver:** Accountant (`accountant`) receives transaction confirmation signals.
  * *Code Checkpoint:* Notification record created in [app/api/parent/fees/confirm-payment/route.ts#L148-L157](file:///c:/Users/ADMIN/School-OS/app/api/parent/fees/confirm-payment/route.ts#L148-L157).
* **Approver:** N/A (signature cryptographically verified using basic hash match).
* **Auditor:** Owner (`owner`) / Accountant (`accountant`) / Super Admin (`super_admin`).
* **Reporter:** Surfaced on Accountant Payment Registers, Ledger sheets (Tally), and Owner financial dashboard.
* **Downstream:** Accountant (completes monthly bank reconciliation).

---

### Event 6: Admissions CRM Inquiry Created
* **Creator:** External Parent (completes enquiry webform) or Admission Officer (`admission_officer` - walk-in input).
  * *Code Checkpoint:* Calls POST in [app/api/admissions/create/route.ts#L65](file:///c:/Users/ADMIN/School-OS/app/api/admissions/create/route.ts#L65).
* **Editor:** Admission Officer (`admission_officer`) / Principal (`principal`).
* **Receiver:** Parent (`parent`) receives a confirmation WhatsApp.
  * *Code Checkpoint:* WhatsApp confirmation sent to parent in [app/api/admissions/create/route.ts#L94-L98](file:///c:/Users/ADMIN/School-OS/app/api/admissions/create/route.ts#L94-L98).
* **Approver:** Admission Officer (`admission_officer`) transitions status: `new` -> `called` -> `enrolled`.
* **Auditor:** Principal (`principal`) / Owner (`owner`).
* **Reporter:** Surfaced on Admissions CRM Lead Pipeline board.
* **Downstream:** Admission Officer (initiates callback queue).

---

### Event 7: Leave Request Submitted
* **Creator:** Teacher (`teacher`) or other staff member.
  * *Code Checkpoint:* Gated by `requireTeacherSession` in [app/api/teacher/leave/route.ts#L85](file:///c:/Users/ADMIN/School-OS/app/api/teacher/leave/route.ts#L85).
* **Editor:** N/A (cannot edit once submitted; must cancel or submit new request).
* **Receiver:** Principal (`principal`) or school leader.
  * *Code Checkpoint:* Gated notification sent to leadership in [app/api/teacher/leave/route.ts#L135-L142](file:///c:/Users/ADMIN/School-OS/app/api/teacher/leave/route.ts#L135-L142).
* **Approver:** Principal (`principal`) reviews and acts on the request.
* **Auditor:** Accountant (`accountant`) checks leave logs before finalizing monthly payroll runs.
* **Reporter:** Surfaced on Principal Leave Approvals board.
* **Downstream:** Principal (selects class substitute).

---

### Event 8: Leave Approved / Rejected
* **Creator/Approver:** Principal (`principal`).
  * *Code Checkpoint:* Updates status via PATCH in [app/api/admin/leave-approvals/route.ts#L50-L55](file:///c:/Users/ADMIN/School-OS/app/api/admin/leave-approvals/route.ts#L50-L55).
* **Editor:** N/A. Status cannot be modified once approved/rejected.
* **Receiver:**
  * Teacher (`teacher`) receives request update.
  * Substitute Teacher (`teacher`) receives substitute assignment confirmation.
  * Class Parents (`parent`) receive notification of substitute arrangements.
    * *Code Checkpoint:* WhatsApp notification sent to class parents in [app/api/admin/leave-approvals/route.ts#L213-L218](file:///c:/Users/ADMIN/School-OS/app/api/admin/leave-approvals/route.ts#L213-L218).
* **Auditor:** Accountant (`accountant`) updates payroll payslips for unpaid leaves.
  * *Code Checkpoint:* Payslip adjustments handled in [app/api/admin/leave-approvals/route.ts#L144-L161](file:///c:/Users/ADMIN/School-OS/app/api/admin/leave-approvals/route.ts#L144-L161).
* **Reporter:** Logged to Activity Log under `leave_approval`.
  * *Code Checkpoint:* Activity logged in [app/api/admin/leave-approvals/route.ts#L224-L229](file:///c:/Users/ADMIN/School-OS/app/api/admin/leave-approvals/route.ts#L224-L229).
* **Downstream:** Substitute Teacher (assumes teaching duty), Accountant (processes deduction).

---

### Event 9: AI Report Card Narrative Generated
* **Creator:** Principal (`principal`).
  * *Code Checkpoint:* Gated by session check in [app/api/report-cards/generate/route.ts#L34](file:///c:/Users/ADMIN/School-OS/app/api/report-cards/generate/route.ts#L34).
* **Editor:** Principal (`principal`) can regenerate comments or manually override narrative text.
* **Receiver:** Parent / Student (`parent` / `student`).
* **Approver:** Principal (`principal`) must approve comments to include them in the final PDF report card generation.
  * *Code Checkpoint:* Narrative status checked in [app/api/admin/report-cards/generate/route.ts#L118](file:///c:/Users/ADMIN/School-OS/app/api/admin/report-cards/generate/route.ts#L118).
* **Auditor:** Owner (`owner`) / HOD (`hod`).
* **Reporter:** Surfaced on final printable report card PDF.
* **Downstream:** Parents / Students (receive card).

---

### Event 10: Hostel Room Allocated
* **Creator:** Hostel Admin (`hostel_admin`).
  * *Code Checkpoint:* Requires `requireAdminSession` in [app/api/admin/hostel/route.ts#L60](file:///c:/Users/ADMIN/School-OS/app/api/admin/hostel/route.ts#L60).
* **Editor:** Hostel Admin (`hostel_admin`).
* **Receiver:** Resident Student (`student`).
* **Approver:** N/A.
* **Auditor:** Principal (`principal`) / Super Admin (`super_admin`).
* **Reporter:** Surfaced on Hostel Occupancy dashboard chart.
* **Downstream:** Resident Student (moves into designated bed).

---

### Event 11: PTM Session Scheduled
* **Creator:** Principal (`principal`) or School Admin (`admin`).
  * *Code Checkpoint:* Resolved via session check in [app/api/admin/ptm/route.ts#L16](file:///c:/Users/ADMIN/School-OS/app/api/admin/ptm/route.ts#L16).
* **Editor:** Creator.
* **Receiver:** Parent (`parent`) and Teacher (`teacher`) see booking slots.
* **Approver:** N/A.
* **Auditor:** Principal (`principal`).
* **Reporter:** PTM bookings scoreboard.
* **Downstream:** Parents / Teachers (book slots).

---

### Event 12: Health Incident Logged
* **Creator:** Principal (`principal`) or Anganwadi Worker (`aww` - automated insert for malnutrition SAM cases).
  * *Code Checkpoint:* Malnutrition SAM escalation logged to health incidents in [app/api/anganwadi/growth/route.ts#L63-L72](file:///c:/Users/ADMIN/School-OS/app/api/anganwadi/growth/route.ts#L63-L72).
* **Editor:** Principal (`principal`) / Admin Staff (`admin_staff`).
* **Receiver:** Parent (`parent`) / Anganwadi Supervisor (`super_admin` - for SAM case NRC referrals).
* **Approver:** N/A.
* **Auditor:** Principal (`principal`).
* **Reporter:** Surfaced on Student Health Log list.
* **Downstream:** Parents (informed of treatment), Supervisor (handles Nutrition Rehabilitation Center referral).
