# Razorpay Setup Guide

> For: Non-developer founder using mobile
> Purpose: Enable online fee collection from parents

---

## What This Does

Razorpay integration lets parents pay school fees online via UPI, debit card, credit card, or net banking. When payment is confirmed, Razorpay sends a webhook to EdProSys which auto-marks the fee as "paid".

---

## Prerequisites

- A Razorpay account (https://razorpay.com — free to sign up)
- KYC verification completed on Razorpay
- School's bank account linked to Razorpay

---

## Setup Steps

### Step 1: Create Razorpay Account

1. Go to https://dashboard.razorpay.com/signup
2. Sign up with your business email
3. Complete KYC (PAN, bank account, address proof)
4. Wait for activation (~1-3 business days)

### Step 2: Get API Keys

1. In Razorpay Dashboard → Settings → API Keys
2. Click "Generate Key"
3. Note down:
   - **Key ID** (starts with `rzp_live_` for production or `rzp_test_` for testing)
   - **Key Secret** (shown only once — save it)

### Step 3: Configure Webhook

1. Razorpay Dashboard → Settings → Webhooks
2. Click "Add New Webhook"
3. **Webhook URL:** `https://www.edprosys.com/api/webhooks/razorpay`
4. **Secret:** Generate a random string (save it for Step 4)
5. **Events to subscribe:**
   - `payment.captured`
   - `refund.processed`
   - `refund.speed_changed`
6. Save

### Step 4: Add Env Vars to Vercel

1. Open Vercel → School OS project → Settings → Environment Variables
2. Add:

| Name | Value |
|------|-------|
| `RAZORPAY_PLATFORM_KEY_ID` | `rzp_live_xxxxxxxxxxxx` |
| `RAZORPAY_PLATFORM_KEY_SECRET` | Your API key secret |

3. Tick Production + Preview + Development
4. Save → Redeploy

### Step 5: Configure in EdProSys

1. Login as school admin
2. Go to Settings → Razorpay (or onboarding step 5)
3. Enter the Razorpay Key ID
4. System will verify the connection

---

## Verification

1. Login as admin → create a test fee for a student
2. Login as parent → go to Fees → tap "Pay Online"
3. Complete payment using Razorpay test card: `4111 1111 1111 1111`
4. Fee should auto-update to "paid" within 30 seconds

---

## Test Mode vs Live Mode

| Mode | Key prefix | Real money? | Use when |
|------|-----------|-------------|----------|
| Test | `rzp_test_` | No | During development and demos |
| Live | `rzp_live_` | Yes | Production with real parents |

**For demos:** Use test mode keys. Parents can use test cards without real payments.

---

## Rollback

Remove `RAZORPAY_PLATFORM_KEY_ID` and `RAZORPAY_PLATFORM_KEY_SECRET` from Vercel env vars → Redeploy. Online payment option will disappear from the parent portal. Manual (cash/cheque) fee collection continues working.

---

## Common Failures

| Problem | Cause | Fix |
|---------|-------|-----|
| "Payment failed" | Test card used with live keys | Switch to test keys for demos |
| Fee not auto-updating after payment | Webhook not configured or wrong URL | Check Razorpay webhook settings |
| "Invalid key" error | Wrong key ID | Verify key starts with `rzp_test_` or `rzp_live_` |
| Webhook returning errors | Wrong webhook secret | Regenerate secret in Razorpay and update Vercel |
