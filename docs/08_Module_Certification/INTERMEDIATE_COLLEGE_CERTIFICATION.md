# Intermediate College Certification Report (Wave 9)

This report evaluates the readiness of School-OS for the **Intermediate College** use case (the founder's primary rollout target), testing against the `TEST_IntermediateCollege_Demo` dataset seeded in the Test Data Library ([docs/15_Test_Data_Library/TEST_IntermediateCollege_Demo.json](file:///c:/Users/ADMIN/School-OS/docs/15_Test_Data_Library/TEST_IntermediateCollege_Demo.json)).

In accordance with Wave 9 guidelines of the EdProSys Production Certification Constitution v1.2, this document distinguishes between items verified by actual code execution and those audited by static code analysis.

---

## 1. Onboarding & Registration Mappings (Core Gaps)

### Gap 9.1: Type Registration Fallback
* **Status:** **Blocked / Degraded**
* **Findings:** In [app/api/schools/create/route.ts#L40-L56](file:///c:/Users/ADMIN/School-OS/app/api/schools/create/route.ts#L40-L56), the `INST_TYPE_MAP` does not contain `intermediate_college`. 
* **Impact:** If a registration payload contains `institution_type: 'intermediate_college'`, the server evaluates `INST_TYPE_MAP[body.institution_type] ?? 'school_k10'` which falls back to `'school_k10'`. Consequently, the tenant is registered as a K-10 school rather than a college.
* **Database Enum Absence:** The `institution_type` database enum created in [supabase/migrations/20260505_phase1_hierarchy.sql#L31-L41](file:///c:/Users/ADMIN/School-OS/supabase/migrations/20260505_phase1_hierarchy.sql#L31-L41) does not contain `'intermediate_college'`. Any attempt to insert `'intermediate_college'` directly into `institutions.institution_type` fails with a database constraint check error. The system relies on `'junior_college'` as the active enum representation.

### Gap 9.2: Regulatory Template Mappings
* **Status:** **Degraded**
* **Findings:** In [app/api/admin/regulatory/setup/route.ts#L12-L25](file:///c:/Users/ADMIN/School-OS/app/api/admin/regulatory/setup/route.ts#L12-L25), `SOURCE_MAP` lacks an entry for `intermediate_college`.
* **Impact:** Any intermediate college fallback setup defaults to `DEFAULT_SOURCES` (`CBSE_ACADEMIC`, `NCERT`) instead of mapping State Intermediate Board templates (`BSE_TELANGANA`, `UGC`) like its junior college counterpart.

---

## 2. Functional Area Audits (End-to-End Evaluation)

### A. Admissions Pipeline
* **Status:** **Degraded**
* **Code References:** [app/api/admissions/create/route.ts#L9-L13](file:///c:/Users/ADMIN/School-OS/app/api/admissions/create/route.ts#L9-L13)
* **Findings:** The admissions scoring rules verify applicant ages using `IDEAL_AGE_MAP` which covers grades 1 to 10. Intermediate college target classes (such as `"11"`, `"12"`, `"Year 1"`, or `"Year 2"`) do not exist in this map.
* **Impact:** Leads applying to college classes receive `undefined` for age ranges, artificially reducing their admissions priority score. Additionally, the counselor LLM system in [app/api/admissions/create/route.ts#L52](file:///c:/Users/ADMIN/School-OS/app/api/admissions/create/route.ts#L52) is hardcoded as a `"premium CBSE school"` counsellor, producing contextually irrelevant logs/insights for college enrollment.

### B. Subjects & Streams
* **Status:** **Functional**
* **Code References:** [app/admin/batches/page.tsx#L120-L140](file:///c:/Users/ADMIN/School-OS/app/admin/batches/page.tsx#L120-L140), [app/api/admin/batches/route.ts#L60](file:///c:/Users/ADMIN/School-OS/app/api/admin/batches/route.ts#L60)
* **Findings:** The admin console provides stream presets (`MPC`, `BiPC`, `CEC`, `HEC`, `MEC`) when editing batches. These are saved to `batches.group_code` successfully.
* **Limitations:** The streams operate purely as labels. The system lacks database or application layer constraints to prevent students in one stream (e.g. `BiPC`) from being assigned to incompatible subject timetables (e.g. Advanced Mathematics).

### C. Sections & Batches
* **Status:** **Functional (with UI constraints)**
* **Code References:** [app/admin/batches/page.tsx#L87](file:///c:/Users/ADMIN/School-OS/app/admin/batches/page.tsx#L87)
* **Findings:** The UI quick-provision button ("Private Junior College Quick Setup" to auto-create 1st and 2nd Year cohorts) is wrapped in `institutionType === 'junior_college'`. It is hidden for colleges registered as `intermediate_college` (or fallen back to `school_k10`).

### D. Timetable scheduling
* **Status:** **Blocked (Shared/Combined Classes)**
* **Code References:** [app/api/admin/timetable/route.ts#L30-L34](file:///c:/Users/ADMIN/School-OS/app/api/admin/timetable/route.ts#L30-L34)
* **Findings:** Intermediate colleges regularly combine sections/streams for common core lectures (e.g., MPC and BiPC sections sharing a Physics lecture hall with a single instructor).
* **Impact:** The database unique index constraints on `timetable` prevent a teacher or class from being double-booked at the same day + period. Attempting to schedule a combined class by adding the same period/teacher to both sections triggers a database validation conflict: `"This teacher is already assigned elsewhere at that day and period."`

### E. Fee Structure
* **Status:** **Functional**
* **Findings:** Cash and online fee collection ledgers compile and execute successfully.
* **Limitations:** The system handles fee structures per class or student profile. It lacks stream-based fee template triggers (e.g., applying higher lab fees automatically to MPC/BiPC streams while applying standard humanities fee structures to CEC).

### F. Attendance & Exams
* **Status:** **Functional (Basic) / Degraded (Exam Patterns)**
* **Code References:** [app/api/teacher/attendance/route.ts](file:///c:/Users/ADMIN/School-OS/app/api/teacher/attendance/route.ts), [docs/15_Test_Data_Library/TEST_IntermediateCollege_Demo.json#L809](file:///c:/Users/ADMIN/School-OS/docs/15_Test_Data_Library/TEST_IntermediateCollege_Demo.json#L809)
* **Findings:** Attendance recording works end-to-end. However, the exam/results recording uses CBSE school term identifiers (`FA1`, `SA1`, `FA2`, `SA2`) rather than board-specific (BIEAP/TSBIE) practical vs. theory structures (e.g., 30-mark science practicals coupled with 60-mark theory papers).

---

## 3. Methodological Note (Performance & Mobile Verification)

* **Performance Verified:** **Not Verified (Methodology Restriction)**
  No active performance load testing or benchmark measurement has been run for this use case. All ratings represent code-level logic evaluation and database schema inspections only. Real execution benchmarks are deferred to Wave 11 (Chaos Certification).
* **Mobile Verified:** **Not Verified (Headless Env)**
  No verification was run on physical mobile emulators due to headless container execution. PWA responsive styles were statically inspected.
