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
* STK-001 (Owner)
* STK-002 (Principal)
* STK-003 (Admin Staff)
* STK-004 (Teacher)
* STK-005 (Head of Department)
* STK-006 (Accountant)
* STK-007 (Counsellor)
* STK-008 (Student)
* STK-009 (Parent)
* STK-010 (Vendor)
* STK-011 (Mandal Education Officer)
* STK-012 (District Education Officer)
* STK-013 (Registrar)
* STK-014 (Librarian)
* STK-015 (Hostel Admin)
* STK-016 (Anganwadi Worker)
* STK-017 (Super Admin)
* STK-018 (Viewer)

