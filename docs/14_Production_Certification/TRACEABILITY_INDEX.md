# Traceability Index

This file tracks end-to-end trace chains linking stakeholders, workflows, APIs, databases, notifications, bugs, fixes, and certifications. Per Rule 6, entries are added only once the relevant IDs have actually been discovered/verified in later waves (Wave 1 Stakeholder Discovery onward) — this file starts empty of real chains.

### Format
```
[STK-ID] ([Role]) -> [WF-ID] ([Workflow Name]) -> [API-ID] ([API Route/Method])
-> [DB-ID] ([DB Table Name]) -> [NTF-ID] ([Notification Channel/Type])
-> [BUG-ID] ([Bug Description]) -> [FIX-ID] ([Fix Reference]) -> [CERT-ID] ([Cert Status])
```

### Illustrative example only (not a real discovered chain — for format reference)
```
STK-004 (Teacher) -> WF-031 (Attendance) -> API-022 (Submit Attendance)
-> DB-ATT-05 (attendance_records) -> NTF-011 (Parent Notification)
-> BUG-014 (Duplicate Notification) -> FIX-009 (Resolved) -> CERT-002 (Passed)
```

### Real Traceability Chains
* STK-001 (Owner) -> Portal: /owner (app/owner/page.tsx)
* STK-002 (Principal) -> Portal: /principal (app/principal/page.tsx)
* STK-003 (Admin Staff) -> Portal: /dashboard (app/dashboard/page.tsx)
* STK-004 (Teacher) -> Portal: /teacher (app/teacher/page.tsx)
* STK-005 (Head of Department) -> Portal: /hod/dashboard (app/hod/dashboard/page.tsx)
* STK-006 (Accountant) -> Portal: /accountant (app/accountant/page.tsx)
* STK-007 (Counsellor) -> Portal: /counsellor (app/counsellor/page.tsx)
* STK-008 (Student) -> Portal: /student (app/student/page.tsx)
* STK-009 (Parent) -> Portal: /parent (app/parent/page.tsx)
* STK-010 (Vendor) -> Portal: /vendor (app/vendor/page.tsx)
* STK-011 (Mandal Education Officer) -> Portal: /meo/dashboard (app/meo/dashboard/page.tsx)
* STK-012 (District Education Officer) -> Portal: /deo/dashboard (app/deo/dashboard/page.tsx)
* STK-013 (Registrar) -> Portal: /registrar/dashboard (app/registrar/dashboard/page.tsx)
* STK-014 (Librarian) -> Portal: /librarian (app/librarian/page.tsx) [Coming Soon Placeholder]
* STK-015 (Hostel Admin) -> Portal: /hostel-admin (app/hostel-admin/page.tsx) [Broken: Gating Defect]
* STK-016 (Anganwadi Worker) -> Portal: /anganwadi (app/anganwadi/page.tsx)
* STK-017 (Super Admin) -> Portal: /super-admin (app/super-admin/page.tsx)
* STK-018 (Viewer) -> Portal: /dashboard (app/dashboard/page.tsx) [Read-Only]


