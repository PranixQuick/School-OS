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
No entries yet — populated starting Wave 1.
