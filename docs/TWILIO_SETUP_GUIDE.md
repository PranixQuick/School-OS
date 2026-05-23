# Twilio + WhatsApp Setup Guide

> For: Non-developer founder using mobile
> Purpose: Enable WhatsApp parent notifications (attendance alerts, fee reminders, PIN delivery)

---

## What This Does

Twilio connects EdProSys to WhatsApp Business API so parents receive automated messages about attendance, fees, homework, and login credentials on WhatsApp.

---

## Prerequisites

- A Twilio account (https://www.twilio.com — free trial gives $15 credit)
- A WhatsApp Business number (Twilio provides a sandbox number for testing)
- Access to Vercel env vars for the School OS project

---

## Setup Steps

### Step 1: Create Twilio Account

1. Go to https://www.twilio.com/try-twilio
2. Sign up with your email
3. Verify your phone number
4. From the Twilio Console dashboard, note down:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "Show" to reveal)

### Step 2: Set Up WhatsApp Sandbox (for testing)

1. In Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. Follow the instructions to join the sandbox (send a WhatsApp message to the Twilio sandbox number)
3. Note the **Twilio WhatsApp number** (e.g., `+14155238886`)

### Step 3: Add Env Vars to Vercel

1. Open https://vercel.com → School OS project → Settings → Environment Variables
2. Add:

| Name | Value |
|------|-------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Your auth token |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (sandbox) or your production number |

3. Tick Production + Preview + Development
4. Save → Redeploy

### Step 4: Configure Webhook (for delivery status)

1. In Twilio Console → Messaging → Settings → WhatsApp Sandbox Settings
2. Set the **Status Callback URL** to: `https://www.edprosys.com/api/webhooks/twilio-status`
3. Save

---

## Verification

1. Login as admin → go to a parent record
2. Use "Resend credentials" or create a fee reminder
3. The parent's WhatsApp should receive the message
4. Check Twilio Console → Monitor → Logs for delivery status

---

## Production WhatsApp (Post-pilot)

For production, you need:
1. A WhatsApp Business account (apply via Twilio)
2. A dedicated phone number (purchase through Twilio, ~$1/month)
3. Message templates approved by WhatsApp (required for proactive messages)
4. Replace the sandbox number with your production number in Vercel env vars

---

## Rollback

Delete the Twilio env vars from Vercel → Redeploy. WhatsApp features will be silently disabled. Parent PINs will need to be shared manually.

---

## Common Failures

| Problem | Cause | Fix |
|---------|-------|-----|
| "21608 - Unverified" | Sandbox requires recipient to join first | Have the parent send "join [keyword]" to the sandbox number |
| Messages not delivering | Wrong `TWILIO_WHATSAPP_FROM` format | Must start with `whatsapp:+` |
| "Authentication error" | Wrong SID or token | Re-copy from Twilio Console |
| Rate limited | Free trial has 1 msg/sec limit | Upgrade to paid account |

---

## Cost Estimate

| Tier | Cost |
|------|------|
| Free trial | $15 credit (~750 messages) |
| Pay-as-you-go | ~$0.005/message (India) |
| 1000 parents × 20 msgs/month | ~$100/month |
