# EdProSys — Pilot School Onboarding SOP

> Standard Operating Procedure for onboarding the first 10 pilot schools

---

## Phase 1: School Selection (Day 0)

1. Identify school: private K-12, 50-500 students, principal is tech-friendly
2. Confirm: school has reliable internet, staff have smartphones
3. Get from school: school name, address, board (CBSE/State/ICSE), medium of instruction, number of classes/sections

## Phase 2: Account Creation (Day 1)

1. Owner/admin registers at `https://www.edprosys.com/register`
2. They enter: school name, their name, email, password
3. System creates school + owner account
4. They are redirected to `/onboarding`

## Phase 3: Onboarding Wizard (Day 1-2)

Guide the admin through all 7 steps:

**Step 1 — School Profile:** Board, medium, institution type, address, logo (optional)

**Step 2 — Classes:** Add class-section pairs (e.g., Class 1-A, 1-B, 2-A). For coaching centers: add batches instead.

**Step 3 — Staff:** Add all teachers and key staff (principal, accountant). For each: name, email, role, designation, subject. System sends email invitations (requires SMTP). Without SMTP: use "Generate Link" and share via WhatsApp.

**Step 4 — Fee Defaults:** Set fee template: tuition amount, frequency (monthly/quarterly/annual), transport fee, hostel fee if applicable.

**Step 5 — Razorpay (optional):** Connect Razorpay for online payments. Can skip and add later.

**Step 6 — Students:** Bulk import students via CSV or add manually. Required: name, class, section, parent phone. System auto-creates parent records with PINs.

**Step 7 — Activate:** Final review and activation. School goes live.

## Phase 4: Staff Onboarding (Day 2-3)

1. Each staff member receives email invitation (or manual link)
2. They click the link, set their password
3. They login → see their role-specific dashboard
4. **Critical test:** Have at least 1 teacher mark attendance for 1 class on Day 2

## Phase 5: Parent Notification (Day 3-4)

1. Admin goes to Parents → Resend Credentials
2. Parents receive WhatsApp/SMS with phone + PIN (requires Twilio)
3. Without Twilio: admin prints PINs and distributes via class teacher
4. **Critical test:** Have 3 parents login via `/parent/login` on Day 3

## Phase 6: First Operations Day (Day 5)

1. All teachers mark attendance before 10 AM
2. Admin verifies attendance data on dashboard
3. Parents verify child attendance on portal
4. Admin creates first broadcast (school notice)
5. Admin marks at least 1 fee as paid

## Phase 7: Validation (Day 5-7)

Check all chains work:
- Attendance → parent visibility → principal dashboard ✓
- Leave request → principal approval ✓
- Fee update → parent visibility ✓
- Broadcast → notification visibility ✓

## Phase 8: Support Handoff

- Share this document with the school admin
- Share the FOUNDER_OPERATIONS_GUIDE.md
- Set up a WhatsApp group: Founder + Admin + Principal
- Schedule weekly check-in call for first 4 weeks

---

## Rollback Plan

If onboarding fails or school wants to stop:
1. Archive the school: `UPDATE schools SET is_active = false WHERE id = '<school_id>'`
2. All data preserved. Can restore anytime.
3. No data is ever deleted.

---

## Escalation Matrix

| Issue | First responder | Escalation |
|-------|----------------|------------|
| Login failure | Founder (password reset via Generate Link) | Check Supabase auth logs |
| Attendance not saving | Founder (check teacher account, staff linkage) | Check Vercel function logs |
| Parent can't login | Founder (reset PIN via admin panel) | Check parents table in Supabase |
| WhatsApp not sending | Founder (check Twilio dashboard) | Verify Twilio env vars in Vercel |
| Page crashes | Founder (check Vercel deployment logs) | Rollback to previous deployment |
