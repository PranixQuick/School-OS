# Workflow Testing Checklist

How to verify the cross-role workflows after each deploy. Demo school: **Suchitra**
(E2E Test School). Demo logins use password `Kukatpally@2026` unless noted.

## Staff alert bell — smoke test
The 🔔 bell lives in the top bar of every staff (sidebar) role.

1. Log in as **demo.principal@suchitra.edprosys.demo** (or owner/accountant).
2. Confirm the 🔔 bell appears in the header, top-right, next to search.
3. Click it — the dropdown opens ("No alerts yet." if none).
4. After triggering a workflow below, a red unread badge appears; clicking an
   alert marks it read and deep-links to the relevant screen.

## Workflow #2 — Fee payment → Accountant / Principal / Owner alerted
**Offline path (no Razorpay needed — use this to demo):**
1. Log in as **demo.accountant@suchitra.edprosys.demo**.
2. Go to Fees, pick any *pending* fee, and mark it paid (cash/cheque/UPI).
3. Log in as **demo.principal** or **demo.owner** → the 🔔 shows
   "Fee payment recorded". ✅

**Online path (Razorpay):** a parent paying via the parent app fires the same
alert to accountant + principal + owner ("Fee payment received").

## Workflow #3 — Fee change → Accountant + Principal alerted
1. Log in as **demo.owner** (or principal/admin).
2. Go to Fees, amend a *pending* fee's amount (a reason is required).
3. Log in as **demo.accountant** or **demo.principal** → the 🔔 shows
   "Fee updated" with the new amount + reason. ✅

## Workflow #5 — Teacher leave → Principal approves → Owner view
1. Log in as a **teacher** (e.g. demo.teacher1@suchitra.edprosys.demo) → Menu →
   Leave → submit a leave request.
2. Log in as **demo.principal** → the 🔔 shows "New leave request"; open Leave
   Approvals and approve/reject it.
3. The **teacher's** bell shows "Leave approved/rejected"; the **owner's** bell
   shows "Teacher leave approved/rejected". ✅

## Workflow #9 — HOD directive → staff + Principal + Owner
1. Log in as **e2e.hod@suchitra.edprosys.demo** → Dashboard → Directives.
2. Write a directive, choose "This institution" or "All branches", and send.
3. Teachers of the target institution(s), the principal(s), and the owner get a
   🔔 "HOD directive: …". ✅

## Notes
- Alerts are scoped to the **active institution**. When an owner switches
  institutions, the bell shows that institution's alerts.
- The bell polls every 60s; reload to see a new alert immediately.
- `staff_alerts` is the in-app feed; outbound WhatsApp/SMS still goes through the
  separate `notifications` queue.

## Pending wirings (same `createStaffAlerts(...)` pattern)
- [x] Teacher leave → Principal approves → Owner view (workflow #5) ✅ done
- [x] Accountant outgoing payment → Principal/Owner approve (workflow #7) ✅ done — accountant logs a payment (Expenses) → principal/owner bells ping → approve/reject → accountant's bell pings
- [x] Staff salary run approval chain (workflow #8) ✅ done — each step (submit_for_review → review → approve → submit_to_bank) alerts the next role's bell
- [x] HOD directive → staff + Principal + Owner (workflow #9) ✅ done — HOD sends a directive → teachers/principal/owner bells ping
- [ ] Exam results published → Student + Parent (workflow #10)
- [x] Homework assigned → HOD + Principal alerted (workflow #4) ✅ done — teacher creates homework → HOD & principal bells ping (students/parents via outbound)
- [x] Student submits homework → assigning teacher alerted (workflow #6) ✅ done — student submits → that teacher's bell pings
