# EdProSys — Stakeholder Testing Guide

> Last updated: 2026-05-23
> For: Founder (Prashanth) and QA testers
> Default password for all demo accounts: `edprosys0000`

---

## General Rules

1. **Always use Incognito/Private mode** when testing multiple roles in sequence. This prevents session contamination.
2. **Logout fully** before switching between roles. Tap sidebar → "Sign out" → wait for login page.
3. **Never use CI accounts** (`ci.admin@edprosys.internal`, `ci.teacher@edprosys.internal`) for demos. These are on a hidden test school.
4. **Language switching** is available on login page and teacher/parent dashboards via language buttons (తె, EN, हि, த, ಕ, म, മ).

---

## Suchitra Academy (Private K-12)

### 1. Owner

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.owner@suchitra.edprosys.demo`
- **Expected redirect:** `/owner`
- **Expected sidebar:** Analytics, Staff, Fee Overview, Settings, Reports
- **Key workflows:**
  - View school analytics dashboard
  - View staff list
  - View fee collection overview
  - Access settings
- **Expected data:** 33 students, 22 staff, 33 fee records
- **What success looks like:** KPI cards show numbers, charts render, no blank screens
- **Known limitations:** Analytics may show zero for some metrics if cron hasn't populated
- **Mobile check:** All cards should stack vertically, no horizontal scroll

### 2. Admin

- **Login URL:** https://www.edprosys.com/login
- **Email:** `admin@suchitracademy.edu.in`
- **Expected redirect:** `/dashboard`
- **Expected sidebar:** Students, Staff, Fees, Attendance, Broadcasts, Complaints, Infrastructure, Library, Transport, Hostel, Timetable, Events, Reports, Settings, and more
- **Key workflows:**
  - View student list → tap a student → see profile
  - View fee list → mark a fee as paid
  - Create a broadcast
  - View complaints → change status
  - Log an infrastructure issue
  - Add a library book
  - View timetable
- **Expected data:** 33 students, 22 staff, 230 attendance records, 5 broadcasts
- **What success looks like:** All lists load with data, forms submit without error, modals open/close
- **Known limitations:** Some modules will show empty states (health incidents = 0, hostel = 0, recordings = 0). This is expected — not a bug.
- **Mobile check:** Sidebar opens via hamburger, forms are usable

### 3. Principal

- **Login URL:** https://www.edprosys.com/login
- **Email:** `principal@suchitracademy.edu.in`
- **Expected redirect:** `/principal`
- **Expected sidebar:** Daily Briefing, Leave Approvals, Risk Flags, Reports, Assessments
- **Key workflows:**
  - View AI-generated daily briefing (1 briefing exists)
  - View leave requests → approve/reject
  - View student risk flags (6 flags exist)
  - View assessment/test data (3 tests, 30 scores)
- **What success looks like:** Briefing card renders with AI text, leave requests list loads, risk flags show severity badges
- **Known limitations:** Briefing is demo data, not live-generated

### 4. Teacher

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.teacher1@suchitra.edprosys.demo`
- **Expected redirect:** `/teacher`
- **Expected sidebar:** Attendance, Marks, Homework, Lesson Plans, Check-in, Leave
- **Key workflows:**
  - View today's schedule (may be empty on weekends)
  - Mark attendance for a class
  - Submit a leave request
  - View homework assignments
  - View VIDYA GRID learning intelligence section (only if VG data exists)
- **Expected data:** Schedule items, low-attendance student alerts
- **What success looks like:** Dashboard loads with greeting, language buttons work, quick action tiles are tappable
- **Mobile check:** 7 language buttons should fit without overflow, quick action grid 2-column

### 5. Accountant

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.accountant@suchitra.edprosys.demo`
- **Expected redirect:** `/dashboard`
- **Expected sidebar:** Fee Management, Fee Reports (restricted to fee-related nav only)
- **Key workflows:**
  - View fee list
  - Mark fees as paid
  - View fee reports
- **Expected data:** 33 fee records
- **What success looks like:** Fee list loads, status badges visible, mark-paid button works
- **Known limitations:** Accountant nav is limited by design — they should NOT see students, staff, or complaints

### 6. Counsellor

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.counsellor@suchitra.edprosys.demo`
- **Expected redirect:** `/dashboard`
- **Expected sidebar:** Limited dashboard view
- **Key workflows:**
  - View student risk flags
  - View notifications
- **Known limitations:** Counsellor role has minimal nav — this is by design

### 7. Parent

- **Login URL:** https://www.edprosys.com/parent/login
- **Credentials:** Phone number + 4-digit access PIN
- **Expected redirect:** `/parent`
- **Key workflows:**
  - View child's attendance summary
  - View fee dues
  - View homework assignments
  - View notifications
- **Expected data:** Child's name, class, attendance percentage, fee status
- **What success looks like:** Child info card loads at top, attendance/fees/homework sections below
- **How to find test credentials:** In Supabase → Table Editor → `parents` table → filter by school_id `00000000-0000-0000-0000-000000000001` → copy any phone + access_pin pair
- **Known limitations:** 28 parents exist with PINs. WhatsApp integration requires Twilio setup.

### 8. Student

- **Login URL:** https://www.edprosys.com/student/login
- **Credentials:** Admission number + PIN
- **Expected redirect:** `/student`
- **Key workflows:**
  - View timetable
  - View homework
  - View attendance
  - View marks
- **How to find test credentials:** Check `students` table for `admission_number` and `access_pin` columns
- **Known limitations:** Student login PIN may not be set for all students. Admin must enable via bulk-enable-login.

---

## ZPHS Peddapalli (Government High School)

### 9. Headmaster (HM)

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.hm@zphs.edprosys.demo`
- **Expected redirect:** `/principal`
- **Expected sidebar:** Same as principal, but with government-specific labels
- **Expected data:** 280 students, 3,424 attendance records, 640 fees
- **Known limitations:** Government school — some private-school features hidden by polymorphism

### 10. DEO (District Education Officer)

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.deo@edprosys.demo`
- **Expected redirect:** `/deo/dashboard`
- **Expected sidebar:** School List, MEO List, Inspections, Reports
- **Key workflows:**
  - View district-level school list
  - View MEO list
  - Access UDISE+ export
- **Known limitations:** DEO is a governance/oversight role. CRUD is limited to viewing.

### 11. MEO (Mandal Education Officer)

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.meo@edprosys.demo`
- **Expected redirect:** `/meo/dashboard`
- **Expected sidebar:** Schools, Inspections, Infrastructure Flags, Compliance
- **Key workflows:**
  - View schools under mandal
  - View infrastructure issues flagged by schools
  - Access compliance reports
- **Known limitations:** MEO sees infrastructure issues only when schools flag items as poor/non-functional

### 12. Clerk

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.clerk@zphs.edprosys.demo`
- **Expected redirect:** `/dashboard`
- **Key workflows:** Administrative data entry, fee tracking
- **Known limitations:** Clerk role maps to admin internally

---

## Anganwadi Centre (ICDS)

### 13. AWW (Anganwadi Worker)

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.aww@anganwadi.edprosys.demo`
- **Expected redirect:** `/teacher` (AWW maps to teacher role)
- **Expected sidebar:** Attendance, Growth Tracking, Nutrition, Immunization
- **Expected data:** 35 beneficiaries, 350 attendance records
- **Key workflows:**
  - Mark daily attendance
  - Record growth measurements
  - Track immunization status

### 14. Supervisor

- **Login URL:** https://www.edprosys.com/login
- **Email:** `demo.supervisor@anganwadi.edprosys.demo`
- **Expected redirect:** `/principal` (Supervisor maps to principal role)
- **Expected sidebar:** Dashboard, Centre Reports, Beneficiary Overview
- **Key workflows:**
  - View centre-level summaries
  - View AWW attendance compliance

---

## Multi-User Testing Procedure

1. Open Chrome/Safari in **Incognito mode**
2. Login as Role A (e.g., Admin)
3. Test the workflows listed above
4. **Logout completely** (sidebar → Sign out)
5. Clear the URL bar, go to `/login` again
6. Login as Role B (e.g., Teacher)
7. Verify you see Teacher nav, NOT Admin nav
8. Repeat for each role

**Critical check:** After switching from Admin to Teacher, confirm:
- Sidebar shows only teacher items (NOT admin items)
- Dashboard shows `/teacher` route (NOT `/dashboard`)
- No admin-only data is visible
