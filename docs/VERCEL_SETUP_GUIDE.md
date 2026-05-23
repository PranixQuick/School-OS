# Vercel Deployment Guide

> For: Non-developer founder using mobile
> Purpose: Understand how EdProSys is deployed and how to manage deployments

---

## Architecture

EdProSys runs on Vercel (https://vercel.com) as a Next.js application. Every push to the `main` branch on GitHub automatically triggers a new deployment. The production URL is `www.edprosys.com`.

| Component | Service | Dashboard |
|-----------|---------|-----------|
| Frontend + API | Vercel | https://vercel.com |
| Database | Supabase | https://supabase.com/dashboard/project/rqdnxdvuypekpmxbteju |
| Domain | Vercel (DNS) | Vercel → Project → Settings → Domains |

---

## Key Environment Variables

These are set in Vercel → Project → Settings → Environment Variables:

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret) | Yes |
| `SESSION_SECRET` | Cookie signing secret | Yes |
| `ANTHROPIC_API_KEY` | Claude API for AI features | Yes (for AI features) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Email sending | No (see SMTP guide) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | WhatsApp | No (see Twilio guide) |
| `RAZORPAY_PLATFORM_KEY_ID`, `RAZORPAY_PLATFORM_KEY_SECRET` | Online payments | No (see Razorpay guide) |
| `VIDYA_GRID_WEBHOOK_SECRET` | VIDYA GRID webhook verification | No |
| `VIDYA_GRID_API_KEY` | VIDYA GRID enrollment sync | No |

---

## How to Redeploy

If you change an environment variable or need to force a fresh deployment:

1. Open https://vercel.com → your project
2. Go to **Deployments** tab
3. Find the latest deployment (top of list)
4. Tap the **⋯** menu → **Redeploy**
5. Confirm
6. Wait 60-90 seconds for "Ready" status

---

## How to Check Deployment Logs

If something is broken:

1. Vercel → Deployments → tap the latest deployment
2. Tap **Functions** tab
3. Look for any function with error indicators
4. Tap to see the log output

For build errors: Deployments → tap the failed deployment → **Build Logs** tab.

---

## How to Roll Back

If a new deployment breaks something:

1. Vercel → Deployments
2. Find the last working deployment (look for a deployment from before the problem started)
3. Tap **⋯** → **Promote to Production**
4. This instantly switches production traffic to that deployment

---

## Domain Configuration

The domain `www.edprosys.com` is configured in Vercel → Settings → Domains. If DNS needs updating:

1. Vercel → Settings → Domains
2. The expected DNS records are shown
3. Update your domain registrar's DNS to match

---

## Common Failures

| Problem | Cause | Fix |
|---------|-------|-----|
| "500 Internal Server Error" | Missing env var or Supabase connection issue | Check env vars, verify Supabase is running |
| "Build failed" | Code error or missing dependency | Check Build Logs for the exact error |
| Site shows old version | Deployment in progress or cached | Wait 2 min, hard-refresh (Ctrl+Shift+R) |
| Functions timing out | Long-running queries | Check Supabase query performance |

---

## Operational Warnings

- **Never delete the production deployment** — use rollback instead
- **Never change `SUPABASE_SERVICE_ROLE_KEY` without updating Vercel** — this will break ALL API routes
- **Preview deployments** are created for every GitHub PR — they use the same database. Be careful with destructive operations on preview deployments.
