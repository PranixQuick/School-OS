# Razorpay Go-Live Checklist

## Status
- ⚠️ Platform is configured with TEST keys only
- ✅ Webhook handler deployed for `payment.captured`, `refund.processed`, `refund.speed_changed`
- ✅ Refund workflow: POST /api/admin/fees/[id]/refund → Razorpay API → `refund_status=processing`
- ✅ Refund confirmation: webhook updates `refund_status=completed` when Razorpay confirms

---

## Founder actions required before accepting real payments

### 1. Razorpay activation
- [ ] Log in to [Razorpay Dashboard](https://dashboard.razorpay.com) → Settings → Live mode activation
- [ ] Submit KYC documents if not already done
- [ ] Wait for approval (typically 1–2 business days)
- [ ] Generate live API keys: Settings → API Keys → Generate for Live mode

### 2. Update Vercel environment variables
- [ ] In Vercel project settings → Environment Variables:
  ```
  RAZORPAY_PLATFORM_KEY_ID=rzp_live_...
  RAZORPAY_PLATFORM_KEY_SECRET=<live_secret>
  ```
- [ ] Redeploy after updating env vars

### 3. Per-school Razorpay keys (optional: if each school has own account)
```sql
UPDATE institutions
SET feature_flags = feature_flags ||
  '{"razorpay_key_id":"rzp_live_...","razorpay_key_secret":"..."}'::jsonb
WHERE id = '<institution_id>';
```

### 4. Configure Razorpay webhook
- [ ] In Razorpay Dashboard → Settings → Webhooks → Add webhook:
  - URL: `https://school-os-rh47.vercel.app/api/webhooks/razorpay`
  - Secret: same value as `RAZORPAY_PLATFORM_KEY_SECRET`
  - Active events: ✓ `payment.captured` ✓ `refund.processed`
- [ ] Test webhook delivery from dashboard

### 5. Configure Twilio (required for WhatsApp notifications)
- [ ] In [Supabase Dashboard](https://supabase.com) → School OS project → Edge Functions → `notifications-dispatcher` → Secrets:
  ```
  TWILIO_ACCOUNT_SID=AC...
  TWILIO_AUTH_TOKEN=...
  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  (Twilio sandbox) or approved number
  TWILIO_TEMPLATE_BROADCAST=HX...
  TWILIO_TEMPLATE_FEE_REMINDER=HX...
  TWILIO_TEMPLATE_HOMEWORK=HX...
  TWILIO_TEMPLATE_ATTENDANCE=HX...
  TWILIO_TEMPLATE_LEAVE=HX...
  ```
- [ ] Create WhatsApp message templates in Twilio Console → Messaging → Templates
- [ ] Get templates approved (WhatsApp Business approval, ~24–48 hours)
- [ ] Update template SIDs in Edge Function secrets above

### 6. Test before launch
- [ ] Send ₹1 test payment from parent phone number
- [ ] Verify `fees.status` updates to `paid` after payment
- [ ] Verify WhatsApp payment receipt notification is dispatched
- [ ] Test refund: POST /api/admin/fees/[id]/refund
- [ ] Verify webhook updates `fees.refund_status` to `completed` after ~1–3 business days

---

## Technical architecture notes

| Component | Status |
|---|---|
| Payment initiation | `/api/parent/fees` → Razorpay order creation |
| Payment capture | Webhook `/api/webhooks/razorpay` → marks fee `paid` |
| Refund initiation | `/api/admin/fees/[id]/refund` → Razorpay refunds API |
| Refund confirmation | Webhook `refund.processed` → marks fee `refund_status=completed` |
| Notifications | Edge Function `notifications-dispatcher` (cron every 5 min) |

## Current notification status (as of Batch 11)
- 28 re-queued notifications pending dispatch
- All failing with `TWILIO_* secrets missing` — configure secrets above to unblock
- 4 remaining `skipped` with `0 recipients resolved` — expected (no parent phone in seed data)
