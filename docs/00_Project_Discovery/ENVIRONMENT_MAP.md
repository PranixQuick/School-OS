# Environment Map

## 1. Core Platform Environment Variables

These variables configure database access, session authentication, and runtime behavior:

| Variable Name | Required | Scope | Purpose |
|---|---|---|---|
| `NODE_ENV` | Yes | Server | Runtime environment mode. Allowed values: `development`, `test`, `production`. Defaults to `development`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Both | The endpoint URL of the Supabase project instance (e.g., `https://[project-id].supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Both | The public anonymous API key for client-side Supabase requests. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server | The privileged service role bypass key (bypasses Row-Level Security). **Must remain secret.** |
| `SESSION_SECRET` | Yes | Server | The secret signing key used to sign stateless JWT cookies (`school_session`, `student_session`, `vendor_session`, and parent OTP tokens). **Must be at least 32 characters long.** |
| `SUPER_ADMIN_EMAIL` | No | Server | Optional email address representing the default system super-admin account. |
| `NEXT_PUBLIC_APP_URL` | No | Both | Optional public URL of the web app (used for auth redirect callbacks and absolute links). |

---

## 2. AI Services (Anthropic & OpenAI)

| Variable Name | Required | Scope | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Server | API key for Anthropic Claude (starts with `sk-ant-`). Gates report narrative and AI assistant queries. |
| `ANTHROPIC_MODEL` | No | Server | Optional model identifier override (e.g. `claude-3-5-sonnet`). |
| `OPENAI_API_KEY` | No | Server | API key for OpenAI services. Used for audio transcription and speech assessments in teacher evaluations. |

---

## 3. Communication & Notification Services (Twilio & Resend)

| Variable Name | Required | Scope | Purpose |
|---|---|---|---|
| `WHATSAPP_PROVIDER` | No | Server | WhatsApp API provider selection (`stub` or `twilio`). In production builds, this **must be set to "twilio"** (stub is blocked). |
| `TWILIO_ACCOUNT_SID` | Cond. | Server | Twilio Account SID. **Required when `WHATSAPP_PROVIDER` is set to "twilio".** |
| `TWILIO_AUTH_TOKEN` | Cond. | Server | Twilio API authentication token. **Required when `WHATSAPP_PROVIDER` is set to "twilio".** |
| `TWILIO_WHATSAPP_FROM` | Cond. | Server | Outbound Twilio WhatsApp virtual sender number. **Required when `WHATSAPP_PROVIDER` is set to "twilio".** |
| `EMAIL_PROVIDER` | No | Server | Email client provider selection (`stub` or `resend`). |
| `RESEND_API_KEY` | Cond. | Server | API key for Resend email dispatch service. **Required when `EMAIL_PROVIDER` is set to "resend".** |

---

## 4. Financial Integrations (Razorpay)

| Variable Name | Required | Scope | Purpose |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | No | Both | Public merchant key ID for loading Razorpay Checkout forms on the frontend. |
| `RAZORPAY_KEY_SECRET` | No | Server | Private key used to authenticate server-side Razorpay API calls. |
| `RAZORPAY_WEBHOOK_SECRET`| No | Server | Key used to verify the HMAC signature of inbound payments webhooks. |

---

## 5. Educational Platform & Sheet Integrations

| Variable Name | Required | Scope | Purpose |
|---|---|---|---|
| `VIDYA_GRID_API_URL` | No | Server | Base URL endpoint for the outbound VidyaGrid integration. |
| `VIDYA_GRID_SERVICE_KEY` | No | Server | Service authorization token for syncing student data to VidyaGrid. |
| `VIDYA_GRID_WEBHOOK_SECRET`| No| Server | Secret key used to verify signatures on inbound VidyaGrid sync webhooks. |
| `GOOGLE_SHEETS_API_KEY` | No | Server | API key to authorize read/write checks against remote Google Sheets data connectors. |

---

## 6. System Cron & Operations

| Variable Name | Required | Scope | Purpose |
|---|---|---|---|
| `CRON_SECRET` | No | Server | Secret authorization string required to trigger system crons on `/api/cron/*` routes. |
| `FOUNDER_EMAIL` | No | Server | Target email address to receive daily abuse digests and critical alerts. |
