# EdProSys — Play Store + Brand Asset Specifications

## App Identity

- **App Name**: EdProSys
- **App ID**: `in.pranix.edprosys`
- **Category**: Education
- **Content Rating**: Everyone
- **Target Audience**: School administrators, teachers, parents
- **Country**: India (IN)

---

## Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#4F46E5` (Indigo-600) | Buttons, active state, icon background |
| Primary Dark | `#3730A3` (Indigo-800) | Splash screen, dark hero |
| Primary Light | `#EEF2FF` (Indigo-50) | Backgrounds, hover states |
| Success | `#16A34A` | Attendance present, fee paid |
| Danger | `#B91C1C` | Fee pending, attendance absent |
| Warning | `#D97706` | Partial attendance, medium risk |
| Text Primary | `#111827` | Headings |
| Text Secondary | `#6B7280` | Subtext |

---

## Icon System

### App Icon (Required for Play Store)

**Sizes needed:**

| Size | Purpose | Format |
|------|---------|--------|
| 512×512 | Play Store high-res | PNG, no transparency |
| 192×192 | Adaptive icon foreground | PNG with transparency |
| 96×96 | Notification icon | PNG monochrome |
| 48×48 | In-app use | SVG (already at `/public/brand/icon.svg`) |

**Design spec:**
- Background: `#4F46E5` (indigo, rounded rect for adaptive icon)
- Foreground: White "E" letterform with 3 horizontal bars
  - Top bar: y=13, width=24, height=5, rx=2
  - Middle bar: y=23, width=19, height=5, rx=2 (shorter for visual interest)
  - Bottom bar: y=33, width=24, height=5, rx=2
- Padding: 20% safe zone on all sides for adaptive icon
- No text in icon (icon-only at small sizes)

**Generation prompt** (for Figma/Photoshop/AI tool):
> "Create a professional app icon for 'EdProSys', a school management SaaS. Indigo (#4F46E5) background with rounded corners (radius = 22.5% of size). White uppercase letter E rendered as three clean horizontal rectangular bars (top full width, middle 80% width, bottom full width), vertically centered with equal spacing. Minimal, modern, institutional feel. No shadow, no gradient, flat design."

---

## Adaptive Icon (Android)

- **Foreground layer**: 108×108dp, icon centered in 72×72dp safe zone
- **Background layer**: Solid `#4F46E5` or gentle radial gradient `#4F46E5` → `#3730A3`
- **Files needed**:
  - `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` (432×432px)
  - `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_background.png` (432×432px)
  - `android/app/src/main/res/drawable/ic_launcher_background.xml` (for solid color: `#4F46E5`)

---

## Splash Screen

- **Background color**: `#1E1B4B` (Indigo-950)
- **Logo**: White variant (`/public/brand/logo-white.svg`), centered, 60% screen width max
- **Duration**: 2000ms (already configured in `capacitor.config.ts`)
- **Spinner**: disabled (already configured)

---

## Feature Graphic (Play Store Required)

- **Size**: 1024×500px
- **Format**: JPG or PNG
- **Design spec**:
  - Background: gradient `#4F46E5` → `#7C3AED` (indigo to violet)
  - Left side: EdProSys logo (white variant) at 40% width
  - Right side: 3 stacked UI mockup cards showing:
    1. Attendance marking screen (teacher mobile)
    2. Parent notification card
    3. Fee collection summary
  - Bottom text (white): "AI-Powered School Management for Indian Schools"
  - Company: "by Pranix AI Labs"

---

## Screenshots (Play Store Required: min 2, recommended 8)

### Phone screenshots (Required: 1080×1920px or similar 9:16)

| # | Screen | Caption |
|---|--------|---------|
| 1 | Login screen (`/login`) | "Sign in securely" |
| 2 | Teacher attendance marking | "Mark attendance in 30 seconds" |
| 3 | Parent dashboard | "Parents stay informed" |
| 4 | Admin fee overview | "Track fees effortlessly" |
| 5 | Event gallery | "Share school memories" |
| 6 | Principal briefing | "AI insights every morning" |
| 7 | Student portal | "Students access everything" |
| 8 | Registration flow | "Set up in 5 minutes" |

### Capture instructions:
1. Install debug APK on Android phone
2. Set screen resolution to 1080×1920
3. Navigate to each screen
4. Take screenshot using power+volume-down
5. Remove status bar via screenshot tool or crop

---

## Play Store Short Description (80 chars max)

> AI school management: attendance, fees, WhatsApp, report cards.

## Play Store Full Description (4000 chars max)

```
EdProSys is the AI-powered operating system for Indian schools and educational institutions.

DESIGNED FOR INDIAN SCHOOLS
Built specifically for how Indian K-12 schools, coaching centers, and colleges operate — WhatsApp first, mobile first, Indian board support.

KEY FEATURES
✅ Attendance Management — Teachers mark attendance from their phones in under 30 seconds.
💰 Fee Management — Track collections, send reminders, manage overdue fees automatically.
💬 WhatsApp Parent Bot — Automated attendance alerts, fee reminders, and homework updates.
📄 AI Report Cards — Generate personalised student narratives using AI (English + Telugu).
🎙 Teacher Evaluation — Upload classroom recordings, get instant coaching scores.
📊 Principal Briefings — Daily AI-generated intelligence briefings every morning.
📸 Event Gallery — Share school event photos with parents securely.
💼 Payroll Management — Indian payroll with PF, ESI, PT, TDS support.

FOR EVERY STAKEHOLDER
• Principal: Daily AI briefing, risk alerts, teacher accountability
• Admin: Students, fees, staff, broadcasts — full control
• Teacher: Attendance, marks, homework from their phone
• Parent: WhatsApp updates, fee tracking, homework alerts
• Student: Timetable, homework, marks — all in one place
• Accountant: Fee collection, payroll, reports

INSTITUTION TYPES SUPPORTED
• K-12 Schools (CBSE, State Board, ICSE)
• Government Schools (DISE/UDISE ready)
• Coaching Centers (batch management)
• Junior Colleges (11-12, PUC)

SECURITY & PRIVACY
• Complete tenant isolation — each school's data is separate
• Row-level security on all 130+ database tables
• DPIIT-recognised company (DIPP241828)
• Data hosted on Supabase (AWS Sydney region)

PRICING
Free plan available. No credit card needed to start.

Developed by Pranix AI Labs Pvt Ltd — Hyderabad, India.
```

---

## CI/CD Pipeline (GitHub Actions)

**File to create**: `.github/workflows/ci.yml`

**Exact steps** (Prashanth manual action in GitHub web UI):
1. Go to https://github.com/PranixQuick/School-OS
2. Click "Add file" → "Create new file"
3. Type path: `.github/workflows/ci.yml`
4. Paste the YAML below
5. Click "Commit changes" → commit to `main`
6. Then add secrets at: Settings → Secrets → Actions:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase project settings)
   - `SUPABASE_SERVICE_ROLE_KEY` (from Supabase project settings)

**CI YAML:**
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  typecheck-and-build:
    name: TypeScript + Build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://rqdnxdvuypekpmxbteju.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      JWT_SECRET: ci-stub-32-chars-minimum-length-x
      ANTHROPIC_API_KEY: sk-stub-ci
      TWILIO_ACCOUNT_SID: ACstub
      TWILIO_AUTH_TOKEN: stub
      TWILIO_WHATSAPP_FROM: whatsapp:+14155238886
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: 1
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - name: TypeScript check
        run: npx tsc --noEmit
      - name: Build
        run: npm run build
```

---

## Android Keystore Generation

Run on your local machine (Mac/Linux):

```bash
keytool -genkey -v \
  -keystore edprosys.keystore \
  -alias edprosys \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Then add to GitHub secrets:
- `KEYSTORE_BASE64` = `base64 -i edprosys.keystore`
- `KEY_ALIAS` = `edprosys`
- `KEY_PASSWORD` = (the password you set)
- `STORE_PASSWORD` = (the keystore password)

---
*Generated: May 2026 · Pranix AI Labs Pvt Ltd*
