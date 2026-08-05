# Repository Map

## 1. Repository Directory Structure

The top-level structure of the School-OS workspace is organized as follows:

| Directory | Purpose | Key Subdirectories / Files |
|---|---|---|
| `app/` | Next.js App Router routes, layouts, pages, and API endpoints. | `api/`, `admin/`, `parent/`, `student/`, `teacher/`, `owner/`, `principal/`, `hod/`, etc. |
| `components/` | Reusable React UI components and layouts. | `HelpPanel.tsx` and stakeholder dashboards. |
| `lib/` | Core business logic, helper libraries, auth scripts, and configuration schemas. | `env.ts`, `session.ts`, `auth.ts`, `student-auth.ts`, `vendor-auth.ts`, `supabaseClient.ts`, `email.ts` |
| `supabase/` | Supabase orchestration. | `migrations/` (86 SQL migration files), `functions/` (11 Edge Functions like `notifications-dispatcher`, `whatsapp-bot`, etc.) |
| `tests/` | Automated test suites. | `unit/` (unit and integration tests run by Vitest), E2E test files run by Playwright. |
| `scripts/` | Local scripts, backfills, diagnostic sessions, and build assets. | `backfill_institutions.ts`, `run-stakeholder-tests.js`, `verify-baked-icon.js` |
| `docs/` | Living documentation system (00 to 15) governed by the Constitution. | Organized from `00_Project_Discovery` to `15_Test_Data_Library`. |
| `public/` | Static media, icons, and public assets. | Manifests, favicons, branding icons. |
| `android/` | Capacitor native Android project wrapper. | Android Studio source files, gradle setup, APK/AAB outputs. |
| `android-assets/` | Launcher and splash assets for compiling native builds. | Icon configurations and density maps. |

## 2. Technical Stack (Derived from package.json)

* **Core Framework:** Next.js `^15.3.0`
* **UI Library:** React `^19.0.0` & React DOM `^19.0.0`
* **Language:** TypeScript `^5.0.0`
* **Database & BaaS Client:** Supabase JS SDK `^2.45.4`
* **Auth & Cryptography:** `jose` `^5.9.6` (JWT session signing), `bcryptjs` `^2.4.3` (PIN hashing)
* **API Integrations:** `twilio` `^5.3.0` (WhatsApp and SMS)
* **Data Validation:** `zod` `^3.23.8` (Zod schemas for env validation and API payloads)
* **PDF Utility:** `jspdf` `^2.5.1` (Report cards and receipts generation)
* **Native Wrappers (Mobile):** Capacitor Core & Android CLI `^6.0.0`
* **Unit Testing:** `vitest` `^1.6.0` (Unit/integration test runner)
* **E2E Testing:** Playwright `@playwright/test` `^1.44.0`
* **Linting:** ESLint `^8.57.0` & `eslint-config-next` `^15.3.0`
