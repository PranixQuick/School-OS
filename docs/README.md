# School-OS Living Documentation

This directory houses the living documentation system under the approved EdProSys Production Certification Constitution v1.2.

## ID Scheme & Naming Conventions

To maintain a traceable matrix from user role to codebase implementation, the following prefix codes must be prefixed to all documented items:

| Code Prefix | Target Domain | Example Description |
|---|---|---|
| **STK-** | Stakeholder / Role | `STK-001 (Owner)`, `STK-004 (Teacher)` |
| **WF-** | Workflow / Flowchart | `WF-012 (Fee Collection)`, `WF-031 (Attendance)` |
| **API-** | API Endpoints / Functions | `API-002 (POST /api/login)`, `API-022 (Submit Attendance)` |
| **DB-** | Database Tables / Schemas | `DB-ATT-05 (attendance_records)` |
| **NTF-** | Notification Events | `NTF-011 (Parent SMS / Push Alert)` |
| **BUG-** | Defects / Registry Issues | `BUG-014 (Duplicate Parent SMS Trigger)` |
| **FIX-** | Resolution / Code Edits | `FIX-009 (Added debounce trigger control)` |
| **CERT-** | Verification & Sign-offs | `CERT-002 (Web & Device Verification Completed)` |
| **FD-** | Founder Decisions | `FD-001 (Owner supports multiple institutions)` |

All file names within subfolders should be capitalized, structured with underscores, and begin with their respective IDs where applicable (e.g. `STK_001_OWNER.md`).
