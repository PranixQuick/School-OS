# School-OS — Lead QA Architect Master Test-Matrix Brief

Prepared for: Mr. Rao (Pranix AI Labs) — for hand-off to the Antigravity IDE agent as the execution brief.
Method: every fact below was independently pulled from the live repo (`PranixQuick/School-OS`, branch `main`) and, where relevant, cross-checked against `origin/main` via GitHub — not from any prior chat claims. File paths are cited throughout. Anything I could not verify is labeled "OPEN" rather than assumed.

**How to use this document**: Sections 1–7 are exactly the 7 items you asked for. Section 8 covers payments/branding since you called those out by name. Section 9 is the part you asked me to add — real bugs, security gaps, and dead code I found while building this that weren't on your original list, but will break testing (or production) if Antigravity doesn't know about them going in. Section 10 is the suggested execution order to hand to Antigravity.

---

## 1. How many onboarding flows exist

**10 distinct entry points — 9 live, 1 fully-built but orphaned (dead code), plus 1 additive security feature that is not itself an onboarding path.**

1. **Institution self-registration** — `/register` → `POST /api/schools/create`
2. **Post-signup setup checklist** — `/onboarding` → `GET /api/onboarding/context` (stage 2 of the same journey as #1)
3. **[DEAD CODE]** Numbered wizard API `/api/admin/onboarding/1-profile` … `7-activate` — fully implemented, DB-writing, but called by **no page anywhere** in the app (only by one e2e spec that admits it "validates the API directly"). Real consequence: `schools.onboarded_at`/`institutions.onboarded_at` is **never set** through any reachable UI path today.
4. **Staff invitation by admin** — email invite, magic-link, or offline `activate-login` — via `/admin/invite-management`, `/admin/credentials`
5. **Staff self-activation via phone OTP** — `/activate`
6. **Student activation via OTP to parent's phone** — `/student/activate`
7. **Vendor activation via OTP** — `/vendor/activate`
8. **Parent onboarding via OTP tied to an existing student record** — `/parent/register` (no independent parent self-registration is possible — it must match a student's `phone_parent`)
9. **Parent returning-user login** — passwordless OTP (`/parent/login-otp`) or PIN (`/parent/login`)
10. **Biometric enrollment** (`/account/biometric`) — device-local app-lock layered on top of any already-established session; not itself an onboarding path, no server API exists for it at all.

Notes for the test matrix:
- Institution type (govt/private/aided/franchise × k12/higher-ed/anganwadi/coaching) branches the registration form and drives `feature_flags` computed at creation time (`fee_module_enabled`, `meal_tracking_enabled`, `rte_mode_enabled`, `scholarship_tracking_enabled`).
- The institution-type "bucket" constants (`GOVT_TYPES`, `HIGHER_ED_TYPES`, `PRE_PRIMARY_TYPES`, `COACHING_TYPES`) are **independently re-declared in at least 5 files** with slightly different memberships (`components/Layout.tsx`, `app/api/onboarding/context/route.ts`, `app/api/schools/create/route.ts`, `app/api/parent/health/route.ts`, `app/dashboard/page.tsx`) — real drift risk; test each institution type against each of these 5 files' behavior, don't assume they agree.
- Values `pre_school`, `kg`, `coaching_center`, `tuition_center`, `intermediate_college` exist in code but are **not selectable anywhere in the actual registration dropdown** — unreachable through normal onboarding today.

---

## 2. Auth matrix

| Role(s) | Login route | Session cookie (issuer) | Guard file | Extra scoping |
|---|---|---|---|---|
| owner, principal, admin_staff/admin, accountant, viewer, counsellor | `/login` → `/api/auth/login` (password, Supabase Auth used only to verify the password) | `school_session` (HS256, issuer `school-os`, 7d, httpOnly/secure/sameSite=lax) | `lib/admin-auth.ts` | `viewer` = GET-only; `accountant` (or an `admin` whose `staff.designation==='School Accountant'`) restricted to `ACCOUNTANT_ROUTE_ALLOWLIST` (fee routes only) |
| owner | same | same | `lib/owner-auth.ts` | Resolves ALL schools under the owner's `institution_id` — intentionally cross-school |
| principal | same | same | `lib/principal-auth.ts` | Tenant-matched to one school |
| teacher | same | same | `lib/teacher-auth.ts` | Tenant-matched to one school |
| hod | same | same (embeds `hod_scope` at login) | `lib/hod-auth.ts` | Can span multiple schools/departments via `hod_scope` baked into the JWT — **not re-checked per request**, so a scope change mid-session doesn't take effect until the token expires |
| parent | `/parent/login` (phone+PIN) or `/parent/login-otp` | separate `parent_session` (issuer `edprosys-parent`, 7d) | `lib/parent-auth.ts` | bcrypt PIN w/ legacy-plaintext auto-migrate; checks `revoked_sessions` denylist |
| student | `/student/login` or `/student/login-otp` | separate `student_session` (issuer `school-os-student`, 7d) | `lib/student-auth.ts` | requires `is_active` + `student_login_enabled`; **no revocation-denylist check** — a logged-out student session stays valid until natural expiry |
| vendor | `/vendor/login`, first activation via `/vendor/activate` | separate `vendor_session` (issuer `school-os-vendor`, 7d) | `lib/vendor-auth.ts` | requires `has_portal_access` + `is_active`; ambiguous email = auth failure; **no revocation-denylist check** |
| super_admin | same universal `/login` (no separate super-admin login) | `school_session` | `lib/super-admin-auth.ts` | **Not a DB role at all** — gated purely on `email.endsWith('@pranixailabs.com')` |
| cron/system | n/a (machine-to-machine) | n/a | `lib/cron-auth.ts` | Vercel `x-vercel-cron: 1` header OR `Authorization: Bearer <CRON_SECRET>`; **falls open in non-production if `CRON_SECRET` unset** |
| meo, deo, registrar, librarian, hostel-admin, placement | universal `/login` | `school_session` | **no dedicated guard file** — inline `session.userRole` array checks per route (meo/deo), or (registrar) **no role check found at all**, or (librarian/hostel-admin/placement) no enforced session role exists — see Section 9 | — |

Shared primitives: `lib/otp.ts` (MSG91-backed, bcrypt-hashed 6-digit code, 10-min TTL, 3-per-15-min rate limit) underlies every OTP-based flow above. `lib/biometric.ts` is a device-local app-lock only — it never touches the session cookie and has no server route.

**middleware.ts** only checks "does a `school_session` cookie exist" for non-public, non-API pages — it does **not** validate the role, and it does **nothing at all** for any `/api/*` route (`if (pathname.startsWith('/api/')) return NextResponse.next()`). All real authorization is delegated to the guard files above, route by route. This means **any new API route that forgets to call a guard has zero authentication by default** — flag this as a mandatory checklist item for every route Antigravity touches going forward.

Security findings surfaced while building this matrix (see Section 9 for the full, worse list): several routes trust client-sent `x-school-id`/`x-user-role`/`x-parent-id` headers based on stale comments claiming "middleware injects these" — middleware does not inject any headers, full stop. Test these as real vulnerabilities, not theoretical ones.

---

## 3. Onboarding procedure (step detail per flow)

**Flow 1 — Institution self-registration** (`app/register/page.tsx` → `app/api/schools/create/route.ts`): collects institution name, admin name, ownership type (`private/government/aided/franchise`), institution type (15 selectable options), address, district (govt only, for DISE/UDISE), admin email/phone, and board/affiliation (form swaps between school-boards list and higher-ed-affiliations list depending on institution type). Server creates `organisations` → `institutions` → `schools` → owner `school_users` row, provisions a real Supabase Auth user inline with a generated password (`edprosys{id}`) so the owner can log in immediately — no email round-trip required.

**Flow 2 — Setup checklist** (`app/onboarding/page.tsx`): 10 steps (`school_info, classes, staff, students, fee_templates, academic_year, broadcast, parents, import, report_cards`), each shown/hidden/relabelled by institution-type flags (e.g. "classes" becomes "age groups" for anganwadi, "batches" for coaching, "programmes and batches" for higher-ed; fee-templates step hidden for govt/anganwadi). Each step just deep-links to an existing page; progress is tracked **client-side only in `localStorage`** (key `edprosys_onboarding_v1`), auto-marked complete from live API calls. Note: `/onboarding` itself is in `middleware.ts`'s public allowlist, so an unauthenticated visitor can render the checklist shell (low severity — every linked sub-page still requires real auth).

**Flow 4 — Staff invitation**: admin sends an email invite or generates a one-time magic link (`/admin/invite-management`) — the magic-link path exists specifically because `.edu.in` domains reject standard invite emails via SMTP. `/admin/credentials` bulk-dispatches student/parent login credentials via SMS. `activate-login` lets an owner/principal/admin/meo directly provision an account with a chosen password, bypassing email entirely — documented as the fix for accounts that otherwise get stuck with no way to log in.

**Flow 5 — Staff self-activation**: phone OTP request → verify → the staff member sets their own password on verify → redirected to `/login` (does not auto-login).

**Flow 6 — Student activation**: resolve by admission number (+school if ambiguous) → requires `student_login_enabled=true` → OTP sent to the **parent's** registered phone → sets a bcrypt PIN → issues a student session directly (no separate login step needed).

**Flow 7 — Vendor activation**: requires `vendors.has_portal_access=true` and a unique `portal_email` → OTP to `vendors.contact_phone` → sets bcrypt PIN → issues vendor session directly.

**Flow 8 — Parent onboarding**: the phone must already match an active student's `phone_parent` — there is no way to create a parent identity that isn't tied to an existing student. Includes a post-activation language-selection step (7 languages).

**Flow 9 — Parent return login**: OTP (existence-gated on the `parents` table, i.e. only works after Flow 8 has run once) or PIN.

---

## 4. Hierarchy of stakeholders and types

**Canonical `role_v2` enum (10 DB values, `lib/authz.ts`)**: `owner, principal, admin_staff, accountant, teacher, reception, admission_officer, parent, student, super_admin`. **`reception` and `admission_officer` exist in the enum but have zero implementation anywhere** — no nav, no guard, no API check. Treat as reserved/future.

```
PLATFORM LEVEL
└─ super_admin — gated by @pranixailabs.com email suffix, not a role check

INSTITUTION-OWNER LEVEL (cross-school within one institution_id)
└─ owner

INSTITUTION-MANAGEMENT LEVEL (single school)
├─ principal
├─ admin_staff / admin (legacy alias, treated as equivalent almost everywhere)
│    └─ "School Accountant" designation (a staff.designation sub-role, not role_v2) — restricted to fee routes, same as a true accountant
└─ accountant (dedicated role_v2) — fee-domain-only nav and API access

ACADEMIC / OPERATIONAL STAFF
├─ teacher (anganwadi's "AWW" worker demo account reuses this same role)
├─ hod — multi-school/department scope via hod_scope; higher-ed-flavored nav (assessments, internships, placement, accreditation)
├─ registrar — thinnest role: one dashboard page, no role-check found on its own API route (see Section 9)
├─ counsellor
├─ viewer — read-only, GET-only enforced at the API layer
├─ librarian — exists only as a staff.role designation tag; the UI is a literal "Coming Soon" stub, no session-role gate, no API folder
└─ hostel-admin, placement — folder/page exists, but no distinct session role or API namespace; placement is a 2-line redirect stub, hostel-admin routes through the ordinary admin API

EXTERNAL / GOVERNMENT OVERSIGHT (govt-school hierarchy)
├─ deo (District Education Officer) — can manage/onboard MEOs
   └─ meo (Mandal Education Officer) — scoped under a DEO
   (anganwadi's "ICDS Supervisor" demo account reuses the principal role)

END-CONSUMER / EXTERNAL TIER (separate tables/JWTs from school_users)
├─ parent
├─ student
└─ vendor — confirmed the thinnest role in the entire system (see Section 6)

SYSTEM (non-human)
└─ cron caller
```

Multi-tenancy: `schools.accounting_mode` (`'dedicated'|'admin_only'`) governs whether a school uses a real accountant role or keeps accounting with admin staff. Institution-type flags (`isGovernment`, `isHigherEducation`, `isPrePrimary`, `isCoaching`, `isAnganwadi`) reshape nav per role — e.g. fees/payroll hidden for anganwadi, library/hostel hidden for anganwadi/coaching, RTE hidden for higher-ed/coaching/anganwadi. Anganwadi and govt-school staff don't get their own `role_v2` values — they reuse `teacher`/`admin`/`principal` with a specialized `anganwadi_admin` nav view layered on top client-side.

---

## 5. Each stakeholder's responsibilities, current build, and dashboard/UI status

*(Full page-by-page Add/Amend/Delete tables are in Section 6 — this section is the responsibility summary + build-completeness verdict per role, for quick reference.)*

| Role | Core responsibility | Dashboard build status |
|---|---|---|
| Owner | Cross-school oversight | Dashboard is **fully read-only** — no mutation capability on the one page it has, despite `/api/owner/financials`, `/api/owner/schools`, `/api/owner/staff` existing server-side unused. |
| Principal | Single-school operations command center | Dashboard read-only; only real action is leave approve/reject. |
| Admin/Admin_staff | Day-to-day school administration across ~43 modules | Most complete build in the system — see Section 6. Two real bugs found (Section 9). |
| Accountant | Fee-domain finance only | Functional for fees/expenses; **fee-templates has full CRUD at the API layer but zero admin UI to use it** — flagged gap. |
| Teacher | Attendance, homework, marks, lesson plans, leave | Functional, but carries the most orphaned/legacy backend routes of any role (old parallel implementations never cleaned up). |
| HOD | Department oversight, higher-ed workflows | **Intentionally 100% read-only by design** — every HOD API route explicitly 403s on POST/PATCH/DELETE. |
| Registrar | Dashboard-only role | Thinnest staff role; single page, single GET route, no dedicated auth guard. |
| Counsellor | Student counselling session logging | Fully wired (add + amend). |
| Librarian | Library management | **Not built** — "Coming Soon" stub, no backend at all. |
| Hostel-admin | Hostel allocation | Functional (routes through the shared admin hostel API) but has **no header/logo/back-nav chrome at all**. |
| Placement | Placement drives | **Not built** — redirects to `/dashboard`, though a full placement admin module exists under `/admin/placement` for admin staff. |
| MEO | Mandal-level inspections | Inspections flow fully wired; institution-management CRUD route exists server-side with **no frontend anywhere**. |
| DEO | District-level oversight, manages MEOs | Dashboard read-only; MEO-management CRUD route exists server-side with **no frontend anywhere**. |
| Teacher-eval | AI-assisted teacher evaluation | **Broken** — frontend calls an API route that doesn't exist; will 404 on load. |
| Parent | View child's records, pay fees, raise complaints/consent | Mostly read-only + payment + complaint-raise + consent-toggle + PIN change; one page (`notices`) is silently broken (see Section 9). |
| Student | View own records, submit homework | Almost entirely read-only + homework submission + PIN change. |
| Vendor | Maintain own contact details | Confirmed thinnest role platform-wide: edit 3 contact fields + PIN change, nothing else — no orders/invoices/catalog of any kind exists. |
| Super-admin | Platform operator (Pranix-internal) | Read-only stats/observability + one real mutation (Vidya-Grid entitlement flags per school). No school-creation/deactivation/user-management mutation exists anywhere. |
| Anganwadi | ICDS childcare workflows (beneficiaries, growth, immunization, nutrition, meal stock) | Functional and reasonably complete, but one page calls a non-existent endpoint on every load (see Section 9). |

---

## 6. Dashboard connecting matrix — who has Add / Amend / Delete, by role

Legend: ✅ = capability exists and is wired to a real UI action; — = not applicable/no such capability found. "Read-only" pages have none of the three.

### OWNER
| Page | Add | Amend | Delete |
|---|---|---|---|
| Dashboard | — | — | — |

### PRINCIPAL
| Page | Add | Amend | Delete |
|---|---|---|---|
| Dashboard | — | — | — |
| Leave approvals | — | ✅ (approve/reject) | — |

### ADMIN / ADMIN_STAFF (43 modules — full detail)
| Module | Add | Amend | Delete | Notes |
|---|---|---|---|---|
| Academic years | ✅ | ✅ | — | |
| Accreditation | ✅ | — | — | |
| Assessments | ✅ | ✅ | — | |
| Audit log | — | — | — | read-only |
| Batches | ✅ | ✅ (soft-archive) | — | no hard delete |
| Broadcasts | ✅ | — | — | no edit/recall after send |
| Coaching tests | ✅ | — | — | |
| Complaints | — | ✅ (resolve) | — | admin never creates, only resolves |
| Conversations (WA log) | — | — | — | read-only |
| Credentials | ✅ (send) | — | — | |
| Data privacy (DSAR) | ✅ | ✅ | — | |
| Departments | ✅ | ✅ | — | |
| Events/galleries | ✅ | ✅ | ✅ | **delete has no confirm() — bug, see Section 9** |
| Fees | ✅ | ✅ | ✅ | good confirm-modal-with-reason before delete |
| Fee categories | ✅ | ✅ | — | no delete route |
| Fee receipt (print) | — | — | — | read-only |
| Health incidents | — | — | — | read-only (creation via student medical page) |
| Hostel | ✅ | — | — | add-only, no edit/delete anywhere |
| Import (bulk) | ✅ | — | — | |
| Infrastructure | ✅ | ✅ | — | |
| Internships | ✅ | — | — | |
| Invite management | ✅ | — | — | |
| Knowledge base | ✅ | — | ✅ | **delete has no confirm() — bug, see Section 9** |
| Library | ✅ | — | — | |
| Meals | ✅ | — | — | |
| Night attendance | ✅ | — | — | |
| NL-Ops | ✅ | — | — | operational tool, not entity CRUD |
| Observability | — | — | — | read-only |
| Ops (notification/cron control) | — | — | — | trigger buttons, not entity CRUD |
| Outreach | — | — | — | read-only dry-run in this build |
| Parents | — | ✅ (link/unlink, reset-pin) | — | no admin-side create/delete |
| Payment modes | ✅ (whole-list save) | — | — | |
| Payroll | ✅ | ✅ (status transitions) | — | no delete of runs/structures |
| Placement (admin module) | ✅ | — | — | add-only |
| Programmes | ✅ | ✅ | — | |
| Promotion | — | — | — | trigger only |
| PTM | ✅ | ✅ | — | |
| Regulatory | — | — | — | trigger/acknowledge only |
| Report cards | ✅ (generate) | — | — | |
| Role permissions | — | ✅ | — | fixed role set, no add/delete |
| RTE | ✅ | ✅ | — | |
| Safety compliance | ✅ | — | — | |
| Sanitary | — | ✅ | — | |
| Sanitary inventory | ✅ | ✅ | — | |
| Scholarships | ✅ | ✅ | — | no delete route |
| Security | — | — | — | read-only |
| Settings (institution config) | — | **attempted, broken** | — | **PATCH with no backend handler — see Section 9** |
| Settings → Branding | ✅ | — | — | |
| Staff | ✅ | ✅ (incl. deactivate, confirm-gated) | **API supports it, UI never calls it** | see Section 9 |
| Students | ✅ (enroll) | ✅ (transfer/graduate/withdraw/archive/edit) | — | soft-lifecycle by design, no hard delete anywhere |
| Subjects | ✅ | ✅ | ✅ | good confirm() before delete |
| Timetable | ✅ | ✅ | ✅ | good confirm() before delete |
| Transfer certificates | — | ✅ | — | |
| Transfer certs (print) | — | — | — | read-only |
| Transport | ✅ | ✅ | ✅ | **two deletes have no confirm() — bug, see Section 9** |
| Transport devices | ✅ | — | ✅ | good confirm() before delete |
| Vacancies | ✅ | ✅ | — | |
| Vendors (admin-managed) | ✅ | ✅ | — | no delete route |

### ACCOUNTANT
| Page | Add | Amend | Delete |
|---|---|---|---|
| Expenses (accountant home) | ✅ | ✅ (approve/reject/paid, confirm-gated) | — |
| Defaulters | — | — | — |
| Demand generation | — | — (trigger only) | — |
| Ledger | — | — | — |
| Tally export | — | — | — |
| Fees / Fee categories (shared with admin) | ✅ | ✅ | ✅ | scoped via allowlist |

### TEACHER / HOD / REGISTRAR / COUNSELLOR / LIBRARIAN / HOSTEL-ADMIN / PLACEMENT / MEO / DEO / TEACHER-EVAL
| Role | Page | Add | Amend | Delete |
|---|---|---|---|---|
| Teacher | Check-in | ✅ | — | — |
| Teacher | Attendance | ✅ | ✅ | — |
| Teacher | Curriculum | — | — | — (read-only) |
| Teacher | Homework | ✅ | ✅ (grading) | — |
| Teacher | Leave | ✅ | — | — |
| Teacher | Lesson plans | ✅ | — | — |
| Teacher | Marks | ✅ | ✅ (upsert) | — |
| Teacher | Meal attendance | ✅ | — | — |
| Teacher | Proofs | ✅ | — | — |
| HOD | All pages | — | — | — | **read-only by explicit design — every API route 403s writes** |
| Registrar | Dashboard | — | — | — |
| Counsellor | Sessions | ✅ | ✅ (follow-up done) | — |
| Librarian | — | — | — | — | **not built** |
| Hostel-admin | Allocations | ✅ | ✅ (checkout) | — |
| Placement | — | — | — | — | **not built** |
| MEO | Inspections | ✅ | ✅ (action items) | — |
| DEO | Dashboard | — | — | — |
| Teacher-eval | — | **broken — API missing** | — | — |

### PARENT / STUDENT / VENDOR / SUPER-ADMIN / ANGANWADI
| Role | Page | Add | Amend | Delete |
|---|---|---|---|---|
| Parent | Complaints | ✅ | — | — |
| Parent | Consent | — | ✅ (2 of 4 types) | — |
| Parent | Fees | ✅ (pay) | — | — |
| Parent | Health | — | ✅ | — |
| Parent | Notices | — | — | — | **broken, see Section 9** |
| Parent | Security (PIN) | — | ✅ | — |
| Parent | Register/OTP | ✅ (account creation) | — | — |
| Parent | Vidya-Grid upgrade | ✅ | — | — |
| Parent | everything else (attendance, curriculum, events, homework, marks, timetable, payment-methods, vendors, report-cards) | — | — | — | read-only |
| Student | Homework | ✅ (submit) | — | — |
| Student | Security (PIN) | — | ✅ | — |
| Student | Activation | ✅ | — | — |
| Student | everything else | — | — | — | read-only |
| Vendor | Own profile | — | ✅ (3 contact fields only) | — |
| Vendor | Security (PIN) | — | ✅ | — |
| Vendor | Activation | ✅ | — | — |
| Vendor | *(no orders/catalog module exists at all)* | — | — | — |
| Super-admin | Vidya-Grid plans | — | ✅ | — | the only platform-wide mutation found |
| Super-admin | Stats / ops-dashboard | — | — | — | read-only |
| Anganwadi | Beneficiaries | ✅ | ✅ (status/notes) | — |
| Anganwadi | Growth | ✅ | — | — | **"recent records" fetch is broken, see Section 9** |
| Anganwadi | Immunization | ✅ | ✅ (upsert by dose) | — |
| Anganwadi | MDM stock | ✅ | ✅ (upsert by date) | — |
| Anganwadi | Nutrition | ✅ | — | — |

**No hard-DELETE endpoint exists anywhere for parent/student/vendor/super-admin/anganwadi** — every "removal" need is either a status-flip PATCH or doesn't exist. Don't test for delete-confirmation UX on these five roles; there's nothing to confirm.

---

## 7. Do updates actually reach the real-time stakeholder who's supposed to see them?

**This is the single most important finding in this whole document: in most cases, no.**

There are two independent notification pipelines that don't cover the same ground:
- `lib/dispatcher.ts` — full-featured (WhatsApp + Email, correct recipient resolution) but **only runs when a human manually clicks a button** in `/automation/cron` — it is not on any cron schedule.
- The Supabase Edge Function `notifications-dispatcher` — the **only automated path** (runs every 5 min via pg_cron), but it **hard-filters to `channel='whatsapp'` only** — anything written as `channel:'email'` is never auto-delivered, ever. It also defaults to `dry_run` mode (nothing is actually sent unless explicitly switched to `live` with Twilio creds configured).

| Scenario | Verdict |
|---|---|
| Teacher marks student absent/late → parent notified | **NOT WIRED** — row is written and would be claimed by the cron dispatcher (channel=whatsapp), but the Edge Function has no matching recipient-resolution branch for this exact type/module combo → silently skipped. |
| Principal approves/rejects leave → requesting teacher notified | **MISROUTED** — the notification fires, but the recipient-resolution code ignores which specific person it's for and blasts it to **every parent in the school** instead of the teacher. Same bug in reverse for teacher→principal new-leave-request. |
| Fee payment recorded → paying parent gets a receipt notification | **MISROUTED** — same bug: fans out to every parent in the school, not the one who paid. |
| Parent confirms an online payment → admin/accountant alerted | **NOT WIRED** — written as `channel:'email'`, never auto-claimed by the only live dispatcher. |
| Admin resolves a complaint → filing parent notified | **NOT WIRED** — written correctly as whatsapp, but the module/type combo has no matching resolver branch → silently skipped. |
| Parent files a complaint → admins alerted | **NOT WIRED (automated)** — written as email; only reachable if a human manually clicks "Dispatch" in `/automation/cron`. |
| Substitute teacher assigned → that teacher notified | **NOT WIRED AT ALL** — no notification call exists in the assignment route; the passive in-app banner component that would show it (`SubstituteBanner.tsx`) isn't even mounted anywhere in the app — fully dead. |
| Teacher arrives late (geofence check-in) → principal/admin alerted | **NOT WIRED** — notably, the *receiving* side is fully built and the Edge Function has a working, dedicated resolver for this exact case, but nothing on the *writing* side ever inserts the notification row. Ready plumbing, missing tap. |
| School-wide broadcast → all parents | **WIRED and working** (assuming live mode + configured Twilio templates) — the one confirmed-correct scenario. |

**Bottom line for the test matrix**: assume every cross-stakeholder "X does something and Y is supposed to find out" scenario is broken until proven otherwise by an actual end-to-end test — sending as one stakeholder and confirming delivery as the other, not just checking that a database row got written. A written `notifications` row is not evidence of delivery in this system today.

---

## 8. Payments and branding/logo — the two items called out specifically

### Payments (Razorpay)
There are **two parallel, independently-built fee-payment flows** — only one is linked to the actual parent-facing UI:
- **Live path**: parent taps pay in `/parent/fees` → `POST /api/parent/pay` creates a Razorpay order and an append-only ledger row → parent completes checkout → the app does **not** verify the callback itself, it waits for `app/api/webhooks/razorpay/route.ts` to mark the fee paid on a verified `payment.captured` event.
- **A second, unlinked "Mode A" path** (`create-order`/`confirm-payment`) exists, is idempotent and signature-verified, but no current page calls it.
- **A designed-but-undeployed third reconciler** (`supabase/functions/payments-webhook`) is explicitly gated behind a credential-rotation step and is not live.

**Concrete bug found**: the live webhook path is not partial-payment aware — any captured payment, even a partial one, unconditionally flips the fee to fully `'paid'`. The `/api/parent/pay` route computes a partial-aware due amount, but the reconciler that actually finalizes the payment ignores that and just marks it paid. This is a real, testable correctness bug, not a theoretical one.

Refunds, idempotency, and a 12-item payment test-scenario list (successful/failed/replayed/tampered-signature/partial/cross-tenant/already-paid/timeout/missing-secrets/amount-tampering, etc.) are fully detailed and ready to hand to Antigravity as literal test cases — see the full agent transcript for exact file citations if needed; summarized here for brevity.

Four separate HMAC signature-verification implementations exist across the codebase for different money flows (fee webhook, billing webhook, client-callback confirm, and the undeployed proposal) — only one has unit test coverage. Worth confirming all four are actually correct, not just the tested one.

### Branding/logo
`lib/branding.ts` (per-school custom logo/seal/signature/colors) **only reaches generated documents** — fee receipts, transfer certificates, report cards. It has **no connection at all** to the in-app header logo.

The in-app platform logo (`/brand/icon.png` + "EdProSys" text) is rendered by the shared `components/Layout.tsx`, used by: admin, admin_staff, accountant, principal, owner, hod, registrar, meo, deo, viewer, counsellor, anganwadi_admin.

**Three of the highest-traffic, most customer-facing roles do NOT render this logo at all** — they use entirely separate, bespoke layout shells with no image logo: **teacher** (`app/teacher/layout.tsx` — text/color-block badge only), **student** (`app/student/layout.tsx` — emoji only), **parent** (`app/parent/layout.tsx` — explicitly documented as unable to use the shared Layout because parent auth isn't the staff session type; renders no logo/branding at all). **`hostel-admin` has no header chrome whatsoever** — not even text. `super-admin` also uses its own bespoke internal-ops chrome with no image logo (reasonable given it's Pranix-internal, but worth confirming that's intentional).

So: "logo on every page for every stakeholder" is currently **false** for 4 of the ~19 stakeholder-facing surfaces (teacher, student, parent, hostel-admin) — worth deciding whether this is a real requirement to fix or an acceptable exception before Antigravity spends time "testing" something that was never built to pass.

---

## 9. What I found that wasn't on your original list, but will affect testing (and a couple, production)

You asked me to add anything missed — this is that section. These are things a Lead QA architect would flag as blocking or high-priority before a "test everything" pass even starts, because several of them mean a planned test will fail for reasons that have nothing to do with what's actually being tested.

**Real, currently-live bugs** (not opinions — confirmed in source):
1. `app/admin/settings/page.tsx` saves institution settings via `PATCH /api/admin/institution-config`, but that route only exports `GET` — this Save button will always fail with a 405. Test it, expect it to be broken, then fix it.
2. Four destructive delete actions have **no confirmation dialog** at all before firing: knowledge-base chunk delete, two separate transport deletes (stop removal, student-assignment removal), and event-gallery media delete. Contrast with subjects/timetable/fees/transport-devices, which all do this correctly — the pattern exists in the codebase, it's just inconsistently applied.
3. `app/parent/notices/page.tsx` calls an endpoint that requires a POST body the page never sends — it will silently fail on every load and just show "No notices from school," masking the real error.
4. `app/anganwadi/growth/page.tsx` calls `/api/anganwadi/growth/recent`, which doesn't exist — the "recent records" list will never populate; the real endpoint is a plain GET on `/api/anganwadi/growth`.
5. `app/teacher-eval/page.tsx` calls an API route that was never created — this page is broken on load, full stop.
6. Staff deletion has a working `DELETE` endpoint that the UI never calls — only soft-deactivate is exposed. Not itself a bug, but worth knowing before someone "tests delete staff" and can't find the button.
7. Fee templates have full create/edit/delete support in the API, but **no admin page anywhere lets a human use it** — currently only reachable by seeding through the orphaned onboarding wizard (see #3 below).

**Security gaps worth testing as real vulnerabilities**:
8. Several routes (school geofence config, teacher-location/presence data, bulk academic-year import/rollback, and — most seriously — the parent transport/bus-location endpoint) trust client-sent headers (`x-school-id`, `x-user-role`, `x-parent-id`) based on code comments claiming "middleware injects these." Middleware does not inject any headers, anywhere, ever — I read the whole file. This means these specific endpoints can plausibly be called with forged headers and no real session at all. This deserves a penetration-style test, not just a functional one.
9. Logging out a student or vendor does not actually invalidate their session server-side (no revocation-denylist check on those two session types, unlike staff and parent) — their token stays valid for its full 7-day life regardless of logout.
10. There's a CI/E2E auth-bypass path built into the real production login route (`x-e2e-bypass` header + a shared secret) that, if the secret ever leaked, would be a full authentication bypass for any known staff email. Confirm this secret is genuinely unset/rotated in production, not just assumed to be.
11. `app/api/registrar/dashboard/route.ts` has no role check at all beyond "is there any session" — any authenticated staff role, not just a registrar, can read it today.

**Dead code / orphaned work** (won't break anything, but will waste QA time if Antigravity tries to "test" something that isn't actually reachable):
12. The entire numbered onboarding wizard (`1-profile` → `7-activate`) is fully built server-side and never called by any page — and it's the only place `onboarded_at` ever gets set, which currently never happens for any real school.
13. Teacher's homework/lesson-plans/attendance modules each carry an older, parallel set of API routes nothing calls anymore — real functionality routes through different, working siblings.
14. MEO institution-management and DEO MEO-management both have full CRUD APIs with zero frontend anywhere.
15. A `SubstituteBanner` component was built to show a teacher their substitute assignment but is never actually rendered on any page — matches the missing-notification finding in Section 7.

**Governance flag, unrelated to code but relevant to how future QA/dev work should be run**: earlier in this engagement, I caught the previous IDE-agent session citing a commit hash and date for a fix that do not exist in the repo's history at all (the underlying code fix was real, just the citation was fabricated). Worth building "cite a real, verifiable commit SHA — don't narrate one" into whatever brief goes to Antigravity, and spot-checking its future claims the same way I did here rather than trusting its transcript at face value.

---

## 10. Suggested execution order for Antigravity

Given the scale here (19 stakeholder types, ~130+ distinct pages, dozens of cross-role scenarios), a flat "test everything" instruction will produce shallow coverage. Recommend sequencing it:

1. **Auth matrix first** — every login method × every role, plus the specific security gaps in Section 9 (forged headers, session revocation, E2E bypass). Nothing else is trustworthy to test until sessions/roles are confirmed sound.
2. **Onboarding matrix** — all 9 live flows end-to-end, one full institution type from each bucket (govt, private, anganwadi, coaching, higher-ed) at minimum.
3. **Per-role CRUD matrix** (Section 6) — go module by module; treat every read-only page as an access-control test (can this role see it, can every other role NOT see it) rather than a functional test.
4. **Cross-stakeholder wiring** (Section 7) — this is the highest-value, currently-most-broken area; test as real end-to-end delivery, not "was a database row written."
5. **Payments** — the 12-scenario list in Section 8, especially the partial-payment reconciliation bug.
6. **Branding/logo** — confirm the 4 known gaps (teacher/student/parent/hostel-admin) are accepted as-is or logged as defects, don't re-discover them as "new" findings.
7. **Regression pass** over the 15 concrete bugs in Section 9 — these are known, reproducible, and should be the first fixes verified, not new discoveries.
8. **Crash/negative testing** — malformed payloads, missing sessions, cross-tenant access attempts, and the orphaned/dead routes in Section 9 (confirm they truly 404/error rather than silently doing something unexpected).

This document is the structure you asked for. The actual click-by-click test execution (screenshots, pass/fail evidence, regression logs) is the next phase — handing this to Antigravity as its brief, the same way the admin-auth.ts and Principal-404 tickets were handed off earlier, just with an actual grounded map this time instead of two freeform sentences.
