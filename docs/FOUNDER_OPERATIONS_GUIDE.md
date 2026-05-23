# EdProSys — Founder Operations Guide

> Last updated: 2026-05-23
> For: Prashanth Rao Rangineni (Founder, Pranix AI Labs)

---

## A. How Onboarding Actually Works

EdProSys has a 7-step onboarding wizard at `/onboarding`. Here's what each step does:

1. **School Profile** (`/api/admin/onboarding/1-profile`) — Sets school name, address, board (CBSE/State/ICSE), medium of instruction, institution type (K-12/college/ITI/anganwadi). Creates the school record in the `schools` table and links it to an `institutions` record.

2. **Classes/Batches** (`/api/admin/onboarding/2-classes` or `2-batches`) — For K-12: creates class rows (Class 1-A, 1-B, 2-A, etc.) in the `classes` table. For colleges: creates batch records.

3. **Staff** (`/api/admin/onboarding/3-staff`) — Bulk add teachers and staff. Each staff member gets a row in `staff` table AND a `school_users` row with their role. If SMTP is configured, an invitation email is sent.

4. **Fee Defaults** (`/api/admin/onboarding/4-fee-defaults`) — Sets up fee template (tuition, transport, hostel, etc.) with amounts and frequency (monthly/quarterly/annual).

5. **Razorpay** (`/api/admin/onboarding/5-razorpay`) — Optional. Connects Razorpay for online fee collection. Requires Razorpay API key + secret.

6. **Students** (`/api/admin/onboarding/6-students`) — Bulk import students. Creates `students` rows AND auto-generates `parents` rows with phone numbers and access PINs.

7. **Activate** (`/api/admin/onboarding/7-activate`) — Final step. Marks the school as fully onboarded. Runs initial data seeding (timetable, notifications, etc.).

---

## B. Register vs Onboarding vs Invitations vs Demo Accounts

| Concept | What it does | Who uses it |
|---------|-------------|-------------|
| **Register** (`/register`) | Creates a new school + owner account from scratch. Owner enters school name, their name, email, password. | New school owners signing up for the first time. |
| **Onboarding** (`/onboarding`) | 7-step wizard to configure an already-registered school. | The owner/admin who just registered. |
| **Staff Invitation** (`/api/admin/staff/invite`) | Admin invites a teacher/staff by email. Creates a `school_users` row with `invite_status = 'pending'`. If SMTP works, sends an email with a password-set link. | Admins adding staff to their school. |
| **Generate Link** (`/api/admin/invite-management/generate-link`) | Creates a shareable invite URL that a staff member can open to set their password. Useful when SMTP isn't configured. | Admins who can't send emails. |
| **Demo Accounts** | Pre-created accounts with `@suchitra.edprosys.demo` emails. Password: `edprosys0000`. | You (founder) for demos only. |
| **Real Accounts** | Accounts created via register or invitation with real emails. | Actual school users in production. |

---

## C. How Staff Onboarding Works

1. Admin goes to `/admin/staff` or the onboarding wizard step 3
2. Admin enters staff name, email, role (teacher/principal/accountant/etc.), designation, subject
3. System creates a `staff` row + a `school_users` row
4. If SMTP is configured: system sends an invitation email with a "Set Password" link
5. If SMTP is NOT configured: admin uses "Generate Link" to create a URL, sends it manually (WhatsApp, SMS)
6. Staff member opens the link, sets their password, and can now log in
7. `invite_status` progresses: `pending` → `verified` (after password set)

---

## D. How Parent Onboarding Works

Parents do NOT register themselves. They are auto-created when students are added.

1. Admin adds a student (via onboarding step 6 or `/api/admin/students`)
2. System auto-creates a `parents` row with the parent's phone number
3. System generates a random 4-digit `access_pin`
4. If WhatsApp/Twilio is configured: system sends the PIN to the parent's phone
5. If not configured: admin must manually share the PIN
6. Parent goes to `/parent/login`, enters phone number + PIN

**Important:** Parents don't have email/password logins. They use phone + PIN only.

---

## E. How Student Onboarding Works

Students are added by admins, not self-registered.

1. Admin adds student via bulk import or individual form
2. Student gets a `students` row with `admission_number`
3. For student portal access: admin must set an `access_pin` (via `/api/admin/students/bulk-enable-login`)
4. Student goes to `/student/login`, enters admission number + PIN

---

## F. How School Activation Works

A school goes through these states:

| State | Meaning |
|-------|---------|
| **Registered** | School record exists. Owner has an account. No data. |
| **Onboarding** | Owner is going through the 7-step wizard. |
| **Active** (`is_active = true`) | School is live. Staff can log in. Data flows. |
| **Archived** (`is_active = false`) | School hidden from listings. Accounts can't access data. All data preserved. |

To archive a school (e.g., after a demo):
```sql
UPDATE schools SET is_active = false WHERE id = '<school_id>';
```

To restore:
```sql
UPDATE schools SET is_active = true WHERE id = '<school_id>';
```

---

## G. How Government Institutions Work

Government schools have `institution_type = 'govt_high_school'` or `'govt_primary'` in their institution settings. This triggers:

1. **Polymorphic UI** — Different labels (Headmaster instead of Principal, Mandal instead of District), different nav items visible
2. **MEO auto-flagging** — When infrastructure issues are logged as poor/non-functional, they're automatically flagged to MEO
3. **Geo check-in** — Teachers may require GPS check-in if `geo_required` is enabled
4. **DISE/UDISE reports** — Government report export endpoints available
5. **MDM/meal tracking** — Mid-day meal attendance module active

---

## H. How Institution Polymorphism Works

The system uses `institution_type` and `ownership_type` to control what each school sees:

| institution_type | ownership_type | What changes |
|-----------------|----------------|--------------|
| `school_k12` | `private` | Full feature set. Fee collection, Razorpay, teacher eval. |
| `school_k12` | `government` | No fee collection. DISE reports. MEO oversight. Geo check-in. |
| `anganwadi` | `government` | Growth tracking, immunization, nutrition, MDM. No fees. |
| `iti` | any | Trade management, NTC certification tracking. |
| `college` | any | Affiliation tracking, department management. |

This is controlled by:
- `/api/auth/me` — returns `institution_type` and `ownership_type`
- `/api/onboarding/context` — returns flags like `is_government`, `is_anganwadi`
- `/api/config` — returns the institution type for conditional rendering
- `lib/institution-flags.ts` — contains `ModulesEnabled`, `AssessmentModel`, `AttendanceModel` per type

---

## I. How to Safely Run Demos

1. **Use Incognito mode** — prevents session contamination
2. **Use demo accounts only** — never create real data in demo accounts
3. **Follow the recommended demo flows** in `docs/DEMO_ACCOUNTS.md`
4. **Avoid these pages in private-school demos:** Teacher eval (0 recordings), health incidents (0 data)
5. **For government demos:** Use ZPHS accounts, show the Telugu UI, show DISE export
6. **For anganwadi demos:** Use AWW + Supervisor accounts, show growth tracking

---

## J. How to Avoid CI Contamination

CI test accounts (`ci.admin`, `ci.teacher`) are now isolated on a hidden school called "EdProSys CI Test School" with `is_active = false`. They will never appear in any demo.

E2E tests use `admin@suchitracademy.edu.in` as the default test admin (set via `TEST_ADMIN_EMAIL` GitHub Secret). If E2E tests create test data, it goes into Suchitra Academy. To prevent this:
- E2E tests are designed to be read-only or to clean up after themselves
- The `E2E_BYPASS_SECRET` header prevents actual auth mutations

---

## K. How to Test Multiple Stakeholders Safely

1. Open Chrome Incognito
2. Login as Role A → test → logout
3. Go to `/login` again → login as Role B → test → logout
4. Repeat

**Alternative:** Use different browsers (Chrome = Admin, Safari = Teacher, Firefox = Principal). Each browser maintains a separate session.

---

## L. How to Restore Archived Schools

If you archived a school and need it back:

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/rqdnxdvuypekpmxbteju
2. Go to Table Editor → `schools` table
3. Find the school row
4. Change `is_active` from `false` to `true`
5. Save

All accounts, students, attendance, fees — everything is preserved. Nothing is deleted during archival.

---

## M. How to Prepare a Real Pilot School

1. Have the school owner register at `/register`
2. They complete the 7-step onboarding wizard
3. They add staff (teachers, principal, accountant)
4. Staff receive invitation emails (or manual links)
5. They import students (CSV or manual entry)
6. Parents auto-receive phone PINs (if WhatsApp/Twilio configured)
7. School is live

**Critical prerequisite:** SMTP must be configured for email invitations. See `docs/SMTP_SETUP_GUIDE.md`.

---

## N. How to Reset Passwords / Invitations

- **Staff password reset:** Admin goes to `/api/admin/invite-management/generate-link` → generates a new password-set link → sends to the staff member
- **Parent PIN reset:** Admin goes to the parent record → `/api/admin/parents/[id]/reset-pin` → generates a new PIN → shares with parent
- **Resend credentials:** `/api/admin/parents/resend-credentials` — re-sends PIN via WhatsApp/SMS

---

## O. How WhatsApp Onboarding Works

When Twilio + WhatsApp Business is configured:
1. Parent records are created with phone numbers
2. System sends WhatsApp message with: "Welcome to [School Name] on EdProSys. Your login PIN is: XXXX. Login at edprosys.com/parent/login"
3. Fee reminders are sent via WhatsApp on schedule
4. Attendance alerts are sent via WhatsApp when child is absent

**Without Twilio:** All WhatsApp features are disabled. Admin must share PINs manually.

---

## P. SMTP + Invitation Explanation

Staff invitation emails require SMTP configuration. Without SMTP:
- Registration still works (owner can set password directly)
- Staff can't receive email invitations
- Workaround: use "Generate Link" to create a manual invite URL

See `docs/SMTP_SETUP_GUIDE.md` for setup instructions.

---

## Q. Known Operational Limitations

1. **No real-time push notifications** — Notifications are stored in the database and visible on dashboard. No mobile push yet (requires Firebase/OneSignal setup).
2. **WhatsApp requires Twilio** — Not configured by default. Schools must bring their own Twilio account.
3. **AI features require Anthropic API key** — Report card narratives, principal briefings, and risk detection use Claude. The key is set in Vercel env vars.
4. **Razorpay must be configured per school** — Each school provides their own Razorpay API credentials during onboarding step 5.
5. **iOS app not yet published** — The iOS Capacitor config exists but `npx cap add ios` must be run on a Mac. Android APK is buildable via GitHub Actions.
6. **No email for @edprosys.demo accounts** — Demo accounts have fake emails. Password reset emails won't reach anyone. Password is always `edprosys0000`.
7. **VIDYA GRID integration is webhook-only** — Session data flows from VIDYA GRID to School OS via webhooks. Enrollment sync requires the service key to be set on both Vercel projects.
