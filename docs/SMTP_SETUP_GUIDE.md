# SMTP Setup Guide

> For: Non-developer founder using mobile
> Purpose: Enable email invitations for staff onboarding

---

## What This Does

SMTP (email sending) lets EdProSys send invitation emails to teachers and staff when you add them to your school. Without SMTP, you'll need to manually share invite links.

---

## Prerequisites

You need an email service that provides SMTP credentials. Options (cheapest first):

| Service | Free tier | Cost after free | Setup difficulty |
|---------|-----------|-----------------|-----------------|
| **Gmail SMTP** | 500 emails/day | Free with Google Workspace | Easy |
| **Resend** | 100 emails/day | $20/mo for 50K | Easy |
| **SendGrid** | 100 emails/day | $20/mo for 50K | Medium |
| **Amazon SES** | 62K emails/mo (with EC2) | $0.10 per 1K | Hard |

**Recommended for pilot:** Gmail SMTP (if you have Google Workspace) or Resend.

---

## Setup Steps

### Option A: Gmail SMTP (Simplest)

1. Open https://myaccount.google.com/security
2. Enable **2-Step Verification** if not already on
3. Go to https://myaccount.google.com/apppasswords
4. Create an App Password: App = "Mail", Device = "Other" → name it "EdProSys"
5. Copy the 16-character app password (e.g., `abcd efgh ijkl mnop`)
6. Open Vercel: https://vercel.com → your School OS project → Settings → Environment Variables
7. Add these variables:

| Name | Value |
|------|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your-email@gmail.com` |
| `SMTP_PASSWORD` | `abcdefghijklmnop` (the app password, no spaces) |
| `SMTP_FROM` | `EdProSys <your-email@gmail.com>` |

8. Tick Production + Preview + Development for each
9. Save → Redeploy the project

### Option B: Resend

1. Sign up at https://resend.com
2. Add and verify your domain (or use Resend's test domain for testing)
3. Go to API Keys → Create API Key
4. Copy the key
5. In Vercel Environment Variables:

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` |
| `SMTP_FROM` | `EdProSys <noreply@yourdomain.com>` |

---

## Verification

1. Login to EdProSys as admin
2. Go to Staff → Add Staff → enter a real email you can check
3. Submit the form
4. Check that email's inbox for the invitation

**If no email arrives:**
- Check Vercel logs (Deployments → latest → Functions → look for SMTP errors)
- Verify the env var names are exactly right (case-sensitive)
- Try the Gmail App Password without spaces

---

## Rollback

To disable SMTP: delete the SMTP environment variables from Vercel → Redeploy. The system will fall back to "Generate Link" mode.

---

## Common Failures

| Problem | Cause | Fix |
|---------|-------|-----|
| "Connection refused" | Wrong SMTP_HOST or SMTP_PORT | Double-check values |
| "Authentication failed" | Wrong password or 2FA not enabled | Regenerate app password |
| "From address not verified" | SendGrid/SES requires sender verification | Verify your from address in the email service dashboard |
| Emails go to spam | No SPF/DKIM records | Add DNS records per your email provider's instructions |
