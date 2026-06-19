# EdProSys — OTP + Biometric Coverage Matrix (verification)

Final verification for the OTP + biometric build (spec §3 deliverable, §7 monitoring).
Every stakeholder × onboarding/auth path × OTP-activation × OTP-reset × biometric cell,
mapped to the PR that closes it. **Auth is never hard-broken when `OTP_ENABLED=false`**
(every OTP endpoint returns `503 OTP_DISABLED` and existing PIN/password/magic-link login
keeps working).

## Shared foundation
| Piece | Where | PR |
|---|---|---|
| `phone_otp` table (RLS, service-role only) | `supabase/migrations/20260619_otp01_phone_otp.sql` (applied + in `list_migrations`) | #196 |
| Shared service `lib/otp.ts` (MSG91 body params, bcrypt, TTL, attempts, single-use, `OTP_ENABLED` gate) + unit tests | `lib/otp.ts`, `tests/unit/otp.test.ts` | #197 |
| `POST /api/auth/otp/request` + `/verify` (existence gate, per-phone cap, per-IP guard, generic responses, 10-min proof token) | `app/api/auth/otp/*` | #198 |

## Coverage matrix
| Stakeholder | Onboarding / auth path | OTP activation | OTP reset | Passwordless login | Biometric |
|---|---|---|---|---|---|
| **Parent** | auto-created w/ student; self-register | ✅ #200 (`/api/parent/send-otp`+`verify-otp` rewritten to shared service; replaced insecure WhatsApp flow) | ✅ reset API #199 (`role=parent`); journey: OTP login → change PIN (#186) | ✅ #204 (`/parent/login-otp`) | ✅ #206 (app-level) |
| **Student** | admin add / CSV import; first login | ✅ #201 (`/student/activate`, OTP → parent phone → set PIN) | ✅ reset API #199 (`role=student`, by parent phone); journey: OTP login → change PIN (#187) | ✅ #205 (`/student/login-otp`) | ✅ #206 |
| **Staff** (+ principal, admin_staff, teacher, accountant, librarian, hod, **meo**, **deo**, **registrar**, dean, supervisor, aww, …) | admin invite → Supabase; CSV import; first login | ✅ #202 (`/activate`, OTP → phone → provision Supabase password) — covers all shared-login roles | ✅ reset API #199 (`role=staff`, Supabase password) + existing email magic-link | n/a (email+password; magic-link exists) | ✅ #206 |
| **Vendor** | admin grant portal access; first portal login | ✅ #203 (`/vendor/activate`, OTP → `contact_phone` → set PIN) | ✅ reset API #199 (`role=vendor`) | n/a (passwordless not in scope for vendors) | ✅ #206 |

**Entry points (UI):** parent register (existing) + `/parent/login-otp`; `/student/activate` + `/student/login-otp` (linked from student login); `/activate` (linked from staff `/login`, #207-this PR) ; `/vendor/activate` (linked from vendor login); `/account/biometric` (linked from settings).

## Institution types
Login & activation are **shared code** (the same `parent`/`student`/`staff`/`vendor` flows) regardless of `institution_type`. Private school, govt school, govt-aided, college / higher-ed, coaching, and anganwadi all reuse these paths — wiring OTP into the shared flows covers every institution type. Anganwadi adds beneficiaries/children, whose guardians use the parent phone path and whose workers (`aww`/`supervisor`) are `school_users` on the shared staff login.

## Fail-safe (verified)
- `OTP_ENABLED` false **or** MSG91 keys missing ⇒ `isOtpEnabled()` is false ⇒ `requestOtp`/`verifyOtp` report disabled and every OTP endpoint returns `503 OTP_DISABLED`. PIN / password / email magic-link login is untouched → **no hard break**.
- Biometric is feature-detected: `BiometricLock` renders null on web / non-native / when disabled, so it can never lock out a web user; device-credential fallback + "turn off" escape ⇒ **no lockout**.

## Founder actions (cannot be done by the agent)
- **Vercel env (Production):** `MSG91_AUTH_KEY`, `MSG91_SENDER_ID=PRANIX`, `MSG91_OTP_TEMPLATE_ID`, `OTP_ENABLED=true`, optional `MSG91_BASE_URL`; confirm the `PRANIX` sender + approved OTP template in MSG91 and hand over the template id.
- **Biometric only:** `npm install`, `npx cap sync android`, build + upload a new AAB to the Play Store (the web wiring stays inert until then).

## Optional future niceties (not blocking; reset is already achievable today)
- Dedicated "Reset PIN/password via OTP" buttons on each login page (today: reset works via the `/api/auth/otp/reset` API and via the OTP-login → change-PIN journey).
