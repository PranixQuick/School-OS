# EdProSys — Support & Incident SOP

---

## Login Failures

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| "Invalid credentials" | Wrong email or password | Double-check email case. Reset via Generate Link. |
| Page loads but login button does nothing | JavaScript error | Hard refresh. Check browser console. Clear cache. |
| Redirects to login after logging in | Session cookie not set | Check if browser blocks third-party cookies. Try Incognito. |
| "Unauthorized" on API calls | Session expired | Logout, login again. Session timeout is typically 24h. |
| Parent "Invalid PIN" | Wrong PIN or phone format | Reset PIN via admin → Parents → Reset PIN. Ensure phone includes country code. |

## Password Reset

**Staff:** Admin → Settings → Staff → Generate Invite Link → share with staff member → they set new password.

**Parent PIN:** Admin → Parents → find parent → Reset PIN → new PIN generated → share via WhatsApp or in person.

**Student PIN:** Admin → Students → find student → Set PIN. Or use bulk-enable-login API.

**Admin/Owner:** Use `/forgot-password` → email-based reset (requires SMTP).

## SMTP Failure

| Symptom | Fix |
|---------|-----|
| Invitation emails not sending | Check SMTP env vars in Vercel. Verify SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD. |
| Emails going to spam | Add SPF/DKIM DNS records per email provider instructions. |
| "Authentication failed" in logs | Regenerate Gmail App Password or Resend API key. |
| **Workaround if SMTP is down:** | Use "Generate Link" in admin panel → share link manually via WhatsApp. |

## Twilio/WhatsApp Failure

| Symptom | Fix |
|---------|-----|
| WhatsApp messages not delivering | Check Twilio Console → Monitor → Logs. Look for error codes. |
| "21608 - Unverified" | Sandbox mode: recipient must join sandbox first. Production: verify number. |
| Account suspended | Check Twilio billing. Free trial may have exhausted credits. |
| **Workaround:** | Share parent PINs manually. All features work without WhatsApp. |

## Deployment Issues

| Symptom | Fix |
|---------|-----|
| Site shows old version | Wait 2 min after deploy. Hard refresh. Check Vercel deployment status. |
| Build failed | Vercel → Deployments → failed deployment → Build Logs. Fix code error and push. |
| 500 errors on all pages | Check env vars in Vercel. SUPABASE_SERVICE_ROLE_KEY may have changed. |
| **Emergency rollback:** | Vercel → Deployments → find last working → ⋯ → Promote to Production. |

## Supabase Issues

| Symptom | Fix |
|---------|-----|
| "Connection refused" errors | Check Supabase dashboard → is project paused? Restore if paused. |
| Slow queries | Check Supabase → Database → Query Performance. Look for missing indexes. |
| Data seems wrong | Check Supabase → Table Editor → verify school_id matches expected school. |
| **Emergency:** | Supabase dashboard → Settings → General → pause/restore project. Data preserved. |

## Vercel Outage

1. Check https://www.vercel-status.com for platform status
2. If Vercel is down, EdProSys is down. No workaround.
3. Expected recovery: Vercel uptime is 99.99% historically
4. Communicate to schools: "We're aware of the issue. Service will be restored within [X] minutes."

## Supabase Outage

1. Check https://status.supabase.com
2. If Supabase is down, all data operations fail but static pages may still render
3. Communicate to schools: "Data services are temporarily unavailable. Attendance can be marked when service resumes."
