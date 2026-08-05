# Architecture Map

## 1. System Overview
School-OS (EdProSys) is built as a unified Next.js web application utilizing React 19 and TypeScript, designed to serve multiple stakeholder groups within a multi-tenant framework.

## 2. Frontend / Backend Boundaries
* **Frontend:** Built with Next.js client-side Page components, layouts, and custom React components styled with Vanilla CSS.
* **Backend:** Next.js Server Components and server-side Route Handlers (`app/api/route.ts` files). All database operations are mediated by `@supabase/supabase-js` (via `supabaseAdmin` or `supabaseClient`).

## 3. Session & Authentication Mechanism
Authentication is managed statelessly using cryptographically signed JSON Web Tokens (JWT) using the `jose` library (HS256 algorithm). The session secret (`SESSION_SECRET`) must be at least 32 characters long.

There are three distinct session cookies used by the platform:

| Cookie Name | Target Stakeholders | Session Config & Details |
|---|---|---|
| `school_session` | Owners, Principals, Teachers, Admin Staff, Registrar, HODs, MEO/DEO | Managed via [session.ts](file:///c:/Users/ADMIN/School-OS/lib/session.ts). Tokens are issued for 7 days. If the user has an `HOD` role, the token claims embed their `hod_scope` (departments and schools). |
| `student_session` | Students | Managed via [student-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/student-auth.ts). Authenticated via student admission number and PIN (upgraded to bcrypt). Tokens issued for 7 days. |
| `vendor_session` | Vendors | Managed via [vendor-auth.ts](file:///c:/Users/ADMIN/School-OS/lib/vendor-auth.ts). Authenticated via portal email and PIN. Tokens issued for 7 days. |

### Revocation Denylist (`revoked_sessions`)
To handle logouts and session terminations securely, the application writes the `userId` (`sub` claim) and issuance timestamp (`iat` claim) to the `revoked_sessions` table in Supabase.
* On every verification call, the system queries this denylist.
* **Fail-Open Strategy:** If the database query to the denylist fails, the system fails open (allows the session) to prevent general lockouts in case of a Supabase connection outage.
* An automatic database trigger purges revoked sessions older than 8 days.

## 4. Key Third-Party Integrations
The codebase contains active wiring for the following third-party integrations:

* **Payments (Razorpay):**
  * Merchant key configuration via `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
  * Webhook listener configured at `/api/webhooks/razorpay` validating signatures with `RAZORPAY_WEBHOOK_SECRET`.
* **SMS & WhatsApp (Twilio):**
  * Enabled when `WHATSAPP_PROVIDER` is set to `'twilio'`.
  * Configured via `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM`.
* **Outbound Email (Resend):**
  * Enabled when `EMAIL_PROVIDER` is set to `'resend'`.
  * Uses `RESEND_API_KEY` for dispatching transactional mail.
* **AI & LLM Services (Anthropic & OpenAI):**
  * **Anthropic (Claude):** Core LLM engine configured via `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
  * **OpenAI (Whisper/GPT):** Used for voice query processing and teacher audio evaluation via `OPENAI_API_KEY`.
* **VidyaGrid Integration:**
  * Outbound data synchronization via `VIDYA_GRID_API_URL` and `VIDYA_GRID_SERVICE_KEY`.
  * Webhook listener at `/api/webhooks/vidya-grid` validated using `VIDYA_GRID_WEBHOOK_SECRET`.
* **Google Sheets Connector:**
  * Imports and data pushes configured with `GOOGLE_SHEETS_API_KEY`.

## 5. Deployment Target
* **Target:** Vercel.
* Wired for serverless edge-middleware routing, asset hosting, and API routes. Environment detection variables such as `VERCEL=1` and `VERCEL_ENV=production` are integrated to configure production-grade routing and cookie behaviors (such as `secure` flags).
