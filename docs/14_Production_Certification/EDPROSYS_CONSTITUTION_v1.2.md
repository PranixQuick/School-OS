# EdProSys Production Certification Constitution v1.2 (APPROVED)

**Status:** APPROVED — binding as of founder sign-off, [date to be stamped on adoption].
**Owner:** Mr. Rao (founder, Pranix AI Labs)
**Scope note:** Written for School-OS/EdProSys; reusable as a template for Cart2Save, QuickScanZ, EasyVenuez, VidyaGrid — only wave *content* changes across products, never the governance rules.

This document is the fixed contract for certifying School-OS for production. Once approved, its structure does not change except through an explicit, founder-approved Change Request. New findings attach to the existing wave they belong to — they never trigger a rewrite of the plan.

---

## Founding Rules

**Rule 1 — Never Assume.** Every claim is backed by discovery from source code, the running application, the mobile app, the database, APIs, navigation, permissions, configuration, or observed runtime behaviour.

**Rule 2 — Never Drift.** Once approved: no new phases, no renamed phases, no removed phases, no reordered phases, without explicit founder sign-off. New discoveries attach to the existing relevant wave. Any proposed structural change is submitted as an explicit **Change Request** and takes effect only on founder approval.

**Rule 3 — Discovery Before Testing.** Every module is discovered before it is tested. "There are 15 stakeholder roles" is a guess. "Discovery identified 18 stakeholder roles" is evidence.

**Rule 4 — Safety Rules Are Layered On Top, Not Replaced.**
- Antigravity opens branches and PRs only. It never merges and never deploys to production without a specific, explicit founder go-ahead for that exact action.
- Discovery waves (0–7) are strictly read-only against live production. No schema change, no data mutation, no edge-function deploy happens during discovery.
- **Credential handling:** Antigravity never searches the filesystem, personal folders, notes, or anywhere outside the project's own declared config to find a token, password, or key. Missing a credential means stop and report — never search for one. (Codified after a real incident during this program.)
- **Blocker handling, generalized:** any blocker outside granted tools or access — stop and report, never improvise a workaround.
- Any action touching live production data, deploys, or real user-facing state is a checkpoint requiring explicit founder go — even mid-wave.
- One PR per logical unit of work; the founder reviews and merges.

**Rule 5 — Independent Verification.** No wave, deliverable, or fix is marked complete in the manifest on self-report alone. It is re-verified directly against the live repo, database, or API before being checked off.

**Rule 6 — Repository Is the Source of Truth.** No AI system — Claude, Antigravity, ChatGPT, or any other — may claim a feature exists, a bug is fixed, a workflow is complete, a document is updated, or a migration has executed, without verifiable evidence in the source code, a git commit, a PR, the database, runtime behaviour, a screenshot, logs, or test evidence. Where evidence conflicts with a prior claim, the evidence wins.

**Rule 7 — AI Collaboration Protocol.**

| System | Responsibility |
|---|---|
| **Antigravity IDE** | Discovery, implementation, automated testing, documentation generation, evidence collection. |
| **Claude** | Independent review, architecture critique, code review, direct tool-verified reconciliation against the live repo/DB/API, challenging assumptions. |
| **ChatGPT** | Program governance, certification architecture, maintains the Canonical Execution Manifest, release-readiness judgment, portfolio-level strategy across Pranix products. |
| **Pranix MCP** | Orchestration, memory, evidence indexing, regression history, dashboards, automation. |
| **Founder** | Scope approval, Change Requests, production gates, merge/deploy approvals. |

*Implementation note on manifest integrity:* ChatGPT owns the manifest file and its upkeep, per the founder's decision. Every entry ChatGPT writes into it must cite the specific verified evidence supplied by Claude or Antigravity (PR link, commit SHA, DB query result, screenshot) — the manifest records verified facts, it does not itself originate them. This keeps manifest ownership and Rule 6 (evidence is truth) both intact at once.

---

## Master Structure

**Wave -1 — Program Initialization** *(one-time setup, not a testing wave)*
- Creates the `/docs` structure below.
- Creates the Bug Registry, Fix Registry, Founder Decision Register, Evidence Ledger, and Traceability Index as empty, correctly-formatted living files.
- Establishes the ID scheme and naming conventions.
- Builds the full **Test Data Library** (all ten realistic datasets — Small School, Medium School, Large School, Intermediate College, Engineering College, Trust, Multi-Campus, Government School, Private School, Residential Campus — each with students, parents, teachers, fees, attendance, exams, timetable) so every later wave regresses against identical, known data from day one.
- Verifies required tool access: GitHub, Supabase, Vercel, Android device/ADB — reports gaps rather than guessing around them.
- Confirms in writing that no production action occurs without founder approval, and that this Constitution is the binding reference for every subsequent wave.

**Wave 0 — Project Discovery.** Architecture Map, Repository Map, Database Map, API Map, Navigation Map, Environment Map.

**Wave 1 — Stakeholder Discovery.** The discovered stakeholder catalogue — every role actually implemented.

**Wave 2 — Onboarding Discovery.** Every onboarding path actually implemented in code.

**Wave 3 — Owner Discovery.** Whether the Owner role supports multi-institution/campus management, switching/creation/deletion, delegation, subscription/billing, branding, cross-institution analytics, isolation — determined from code and DB.

**Wave 4 — Dashboard Discovery.** Every stakeholder's every dashboard, page, widget, menu, hidden page.

**Wave 5 — Permission Discovery.** Every button, action, CRUD operation, approval, export, upload, mapped per role.

**Wave 6 — Workflow Discovery.** Every workflow actually implemented, modeled as: Trigger → Processing → Notifications → Database → Reports → Audit → Downstream stakeholders.

**Wave 7 — Relationship Matrix.** For every event: who creates, edits, receives, approves, audits, reports on, and is notified.

**Wave 8 — Module Certification.** Every module rated: Exists / Reachable / Functional / Mobile Verified / Web Verified / Permissions Verified / Performance Verified / Security Verified / Production Ready.

**Wave 9 — Intermediate College Certification.** Admissions, subjects, streams, sections, timetable, fee structure, attendance, exams, results, faculty, parents, students — validated with the Wave -1 Intermediate College dataset.

**Wave 10 — Real Device Certification.** Connected Android phone: every stakeholder, every workflow, portrait, landscape, offline, poor network, background, killed app, resume.

**Wave 11 — Chaos Certification.** Large CSV, broken CSV, duplicate imports, network loss, server restart, session expiry, concurrent users, storage full. Runs against the demo tenant / staging, never live paying-school data.

**Wave 12 — Release Certification.** Evidence-based only. Governed by the Release Gate checklist below.

---

## Evidence & Traceability

**Evidence Ledger** — every fix recorded as:
```
Bug Fixed
Evidence: PR #__, Commit __, Before Screenshot, After Screenshot, Runtime Screenshot
Regression: __
Reviewer: __
Certification: __
```

**Traceability IDs** — every discovered item chained end to end:
```
STK-004 (Teacher) → WF-031 (Attendance) → API-022 (Submit Attendance)
→ DB-ATT-05 (attendance_records) → NTF-011 (Parent Notification)
→ BUG-014 (Duplicate Notification) → FIX-009 (Resolved) → CERT-002 (Passed)
```

**Founder Decision Register:**
```
FD-001 — Owner supports multiple institutions.
Reason: Intermediate College rollout.
Date / Approved by: Founder
Affected Modules: __
Evidence: __
```

**Production Scorecard.** Each wave produces a score per area. Computed directly from the registries wherever the area is measurable (e.g. defect density from the Bug Registry, % permission checks certified, measured load-test numbers). Qualitative, reasoned scoring is allowed only for areas that don't reduce cleanly to a formula (e.g. documentation quality) — and must state the reasoning, not just the number.

**Release Gate (before any production release):**
```
Critical Bugs: 0        High: 0        Medium: <5
Regression: Passed      Security: Passed      Performance: Passed
Documentation: Updated  User Guides: Updated
Rollback Verified       Database Backup Verified
Founder Approval: Required
```

---

## Living Documentation

```
/docs
  /00_Project_Discovery
  /01_Architecture           (+ auto-generated diagrams where derivable from code: ERD, role hierarchy,
                               permission graph, workflow graph, notification graph, API/module
                               dependency graphs, navigation flow, state machines, deployment architecture)
  /02_Database
  /03_APIs
  /04_Stakeholders           (one file per stakeholder: Dashboard, Permissions, Workflow, Notifications,
                               Dependencies, Known Limitations, Production Status)
  /05_Onboarding
  /06_Permissions
  /07_Workflows              (one file per workflow: Entry, Validation, Business Rules, DB Tables,
                               Notifications, Reports, API Calls, UI Screens, Known Bugs, Evidence —
                               plus WHY it works this way: architecture rationale, edge cases,
                               dependencies, limitations, future enhancements, performance notes)
  /08_User_Guides            (per stakeholder: first login, daily tasks, best practices, troubleshooting, FAQ)
  /09_Admin_Guides           (school admin, college admin, owner, multi-institution owner, super admin)
  /10_Test_Evidence
  /11_Bug_Registry
  /12_Fix_Registry
  /13_Release_Notes
  /14_Production_Certification  (this Constitution + Founder Decision Register + final release
                                   certification report)
  /15_Test_Data_Library      (the ten datasets built in Wave -1)
```

---

## Canonical Execution Manifest (tracking format)

Every check-in reconciles against this, in order: current wave; completed deliverables with evidence links; evidence received vs. outstanding; open blockers; next approved task. Status updates never rewrite the plan — they only fill in evidence against the fixed structure above. Any change to wave structure or deliverables is a Change Request requiring founder sign-off. File owner: ChatGPT, per Rule 7, sourcing every entry from Claude/Antigravity-verified evidence.
