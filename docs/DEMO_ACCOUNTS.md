# EdProSys — Demo Accounts

> Last updated: 2026-05-23
> Default password for all staff accounts: `edprosys0000`

---

## ✅ PRODUCTION-SAFE DEMO ACCOUNTS (Active Schools)

### Suchitra Academy (Private K-12)

| Role | Email | Dashboard | Notes |
|------|-------|-----------|-------|
| Admin | `admin@suchitracademy.edu.in` | `/dashboard` | Primary demo account. Staff-linked. Full admin nav. |
| Admin | `demo.admin@suchitra.edprosys.demo` | `/dashboard` | Secondary admin. |
| Owner | `demo.owner@suchitra.edprosys.demo` | `/owner` | Owner analytics dashboard. |
| Principal | `principal@suchitracademy.edu.in` | `/principal` | Primary principal. Staff-linked. Briefing + leave approvals. |
| Principal | `demo.principal@suchitra.edprosys.demo` | `/principal` | Secondary principal. |
| Teacher | `demo.teacher1@suchitra.edprosys.demo` | `/teacher` | Staff-linked. Full teacher dashboard. |
| Teacher | `demo.teacher2@suchitra.edprosys.demo` | `/teacher` | Staff-linked. |
| Teacher | `test.teacher@schoolos.local` | `/teacher` | Staff-linked. Used by E2E tests as fallback. |
| Accountant | `demo.accountant@suchitra.edprosys.demo` | `/dashboard` | Fee-only nav. |
| Counsellor | `demo.counsellor@suchitra.edprosys.demo` | `/dashboard` | Limited nav. |

### ZPHS Peddapalli (Government High School)

| Role | Email | Dashboard | Notes |
|------|-------|-----------|-------|
| Admin/Clerk | `demo.clerk@zphs.edprosys.demo` | `/dashboard` | Government school admin. |
| Principal/HM | `demo.hm@zphs.edprosys.demo` | `/principal` | Headmaster. |
| DEO | `demo.deo@edprosys.demo` | `/deo/dashboard` | District Education Officer. |
| MEO | `demo.meo@edprosys.demo` | `/meo/dashboard` | Mandal Education Officer. |
| Teacher | `demo.teacher1@zphs.edprosys.demo` | `/teacher` | Staff-linked. |
| Teacher | `demo.teacher2@zphs.edprosys.demo` | `/teacher` | Staff-linked. |

### Anganwadi Centre Peddapalli Ward 3 (ICDS)

| Role | Email | Dashboard | Notes |
|------|-------|-----------|-------|
| AWW | `demo.aww@anganwadi.edprosys.demo` | `/teacher` | Anganwadi Worker. Teacher role internally. |
| Supervisor | `demo.supervisor@anganwadi.edprosys.demo` | `/principal` | ICDS Supervisor. Principal role internally. |

### Parent Accounts

| Login URL | Credentials | Count |
|-----------|-------------|-------|
| `/parent/login` | Phone number + 4-digit PIN | 28 parents on Suchitra |

To find parent credentials: Supabase → Table Editor → `parents` table → filter `school_id = 00000000-0000-0000-0000-000000000001` → copy `phone` + `access_pin`.

### Student Accounts

| Login URL | Credentials | Count |
|-----------|-------------|-------|
| `/student/login` | Admission number + PIN | 33 students on Suchitra |

To find student credentials: Supabase → Table Editor → `students` table → filter same school_id → look for `admission_number` + `access_pin` columns.

---

## ⚠️ CI-ONLY ACCOUNTS — NEVER USE IN DEMOS

| Role | Email | School | Why |
|------|-------|--------|-----|
| Admin | `ci.admin@edprosys.internal` | EdProSys CI Test School (hidden) | CI/CD test account. Isolated on inactive school. |
| Teacher | `ci.teacher@edprosys.internal` | EdProSys CI Test School (hidden) | CI/CD test account. Isolated on inactive school. |

These accounts exist solely for GitHub Actions E2E tests. They are on a school with `is_active = false` so they never appear in demo navigation or API queries.

---

## 🗄️ ARCHIVED ACCOUNTS — NON-FUNCTIONAL

| Role | Email | School | Status |
|------|-------|--------|--------|
| Owner | `sushruth@dpsnadergul.com` | DPS Nadergul | School archived (`is_active = false`) |
| Owner | `monsieur.gautam@gmail.com` | Sunrise Academy | School archived |
| Owner | `gautham.sambaraju@gmail.com` | "adasda" | Junk test school, archived |

These accounts are remnants of early testing. They cannot log in to any active school.

---

## Recommended Demo Flow

**For a private school demo (15 minutes):**

1. Login as `admin@suchitracademy.edu.in` → show dashboard, students, fees
2. Logout → login as `demo.teacher1@suchitra.edprosys.demo` → show teacher dashboard, attendance
3. Logout → login as `principal@suchitracademy.edu.in` → show briefing, leave approvals, risk flags

**For a government school demo (10 minutes):**

1. Login as `demo.hm@zphs.edprosys.demo` → show HM dashboard with 280 students
2. Logout → login as `demo.meo@edprosys.demo` → show MEO oversight dashboard
3. Logout → login as `demo.deo@edprosys.demo` → show DEO district view

**For an anganwadi demo (5 minutes):**

1. Login as `demo.aww@anganwadi.edprosys.demo` → show attendance, growth tracking
2. Logout → login as `demo.supervisor@anganwadi.edprosys.demo` → show supervisor overview
