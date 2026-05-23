# VIDYA GRID Integration Guide

> For: Non-developer founder using mobile
> Purpose: Connect EdProSys (School OS) with VIDYA GRID adaptive learning platform

---

## What This Does

VIDYA GRID is Pranix's adaptive learning platform for Class 9-10 Mathematics (SCERT AP, Telugu medium). The integration lets:

1. **School OS → VIDYA GRID:** Enroll students in VIDYA GRID when they're added in School OS
2. **VIDYA GRID → School OS:** Receive learning stagnation alerts, session completion events, and passport updates via webhooks

When connected, teachers see a "Learning Intelligence (VIDYA GRID)" section on their dashboard showing students flagged for learning stagnation.

---

## Architecture

```
School OS                          VIDYA GRID
---------                          ----------
Students table  ──enrollment sync──►  Users table
                                      │
Teacher dashboard  ◄──webhooks────── Session events
Risk flags table   ◄──webhooks────── Stagnation alerts
Passport snapshot  ◄──webhooks────── Passport updates
```

Communication uses:
- **Service token** (School OS → VIDYA GRID): `VIDYA_GRID_API_KEY` / `VIDYA_GRID_SERVICE_KEY`
- **HMAC webhooks** (VIDYA GRID → School OS): `VIDYA_GRID_WEBHOOK_SECRET`

---

## Prerequisites

- Both EdProSys and VIDYA GRID deployed on Vercel
- Supabase projects for both products
- The shared service key: `vgsk_7Kp3mR9xT2wQfN6jL8vB4dY1hA5sE0cU3gW7iX9zJ2nF`

---

## Setup Steps

### Step 1: Service Key (already done if you followed earlier instructions)

**School OS Vercel** (`prj_cjIxaFMlHZQReaf3sdrJY1osCA9V`):

| Env Var | Value |
|---------|-------|
| `VIDYA_GRID_API_KEY` | `vgsk_7Kp3mR9xT2wQfN6jL8vB4dY1hA5sE0cU3gW7iX9zJ2nF` |

**VIDYA GRID Vercel** (`prj_kotdxYxu1ERlIRGvviWlRGGafg5O`):

| Env Var | Value |
|---------|-------|
| `VIDYA_GRID_SERVICE_KEY` | `vgsk_7Kp3mR9xT2wQfN6jL8vB4dY1hA5sE0cU3gW7iX9zJ2nF` |

### Step 2: Webhook Secret

**School OS Vercel:**

| Env Var | Value |
|---------|-------|
| `VIDYA_GRID_WEBHOOK_SECRET` | Copy from VIDYA GRID Supabase → `webhook_endpoints` table → `hmac_secret` column |

### Step 3: Link Schools

In School OS Supabase (`rqdnxdvuypekpmxbteju`):
1. Table Editor → `schools` table
2. Find Suchitra Academy (or whichever school)
3. Set `vidya_grid_school_id` to the corresponding VIDYA GRID school ID (e.g., `PEDDAPALLI-ZPH-001`)

### Step 4: Activate Webhooks

In VIDYA GRID Supabase (`yfhfzmlrqvyfrdkcbkiy`):
1. Table Editor → `webhook_endpoints` table
2. For each of the 3 rows (session_complete, stagnation_alert, enrollment_sync):
   - Set `endpoint_url` to `https://www.edprosys.com/api/webhooks/vidya-grid`
   - Set `is_active` to `true`
3. Save

---

## Verification

1. In VIDYA GRID, complete a test session for a student linked to the School OS school
2. Check School OS Supabase → `vidya_grid_sync_events` table for new rows
3. If a stagnation alert is triggered, check `student_risk_flags` table for a row with `source = 'vidya_grid'`
4. Login as teacher in School OS → check if "Learning Intelligence" section appears on the teacher dashboard

---

## Rollback

To disconnect:
1. Set `is_active = false` on all webhook_endpoints rows in VIDYA GRID Supabase
2. Remove `VIDYA_GRID_API_KEY` from School OS Vercel
3. Redeploy both projects

The integration is fully optional. School OS works without VIDYA GRID.

---

## Common Failures

| Problem | Cause | Fix |
|---------|-------|-----|
| Webhook events not arriving | `is_active = false` on webhook_endpoints | Set to true |
| "Signature mismatch" in School OS logs | Wrong `VIDYA_GRID_WEBHOOK_SECRET` | Re-copy from VIDYA GRID webhook_endpoints.hmac_secret |
| Enrollment sync returns 401 | Wrong or missing service key | Verify both env vars match exactly |
| Teacher dashboard doesn't show VG section | No risk flags with source='vidya_grid' | Section only appears when data exists |
