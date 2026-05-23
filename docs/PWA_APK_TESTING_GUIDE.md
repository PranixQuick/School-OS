# PWA + APK Testing Guide

> For: Non-developer founder using mobile
> Purpose: Test EdProSys as an installable app on Android/iOS

---

## Three Ways to Use EdProSys

| Mode | What it is | Install needed? | Offline? |
|------|-----------|----------------|----------|
| **Web** | Open in browser | No | No |
| **PWA** | "Add to Home Screen" from browser | 1 tap | Partial |
| **APK** | Android app installed via APK file | Yes (sideload) | Partial |

---

## Testing the Web Version

1. Open Chrome on your Android phone (or Safari on iPhone)
2. Go to `https://www.edprosys.com`
3. Login with any demo account
4. Test these:
   - Does the login page load without white screen?
   - Does the dashboard render correctly?
   - Is the sidebar accessible via hamburger menu?
   - Can you tap all buttons?
   - Does the language switcher work?
   - Is there horizontal scroll on any page? (There shouldn't be)
   - Does the keyboard overlap input fields? (It shouldn't)

---

## Testing the PWA (Add to Home Screen)

### Android (Chrome)

1. Open `https://www.edprosys.com` in Chrome
2. Tap the **⋮** menu (three dots, top right)
3. Tap **"Add to Home screen"** or **"Install app"**
4. Confirm the name "EdProSys"
5. The EdProSys icon appears on your home screen
6. Open it — it should load in a standalone window (no browser address bar)

### iPhone (Safari)

1. Open `https://www.edprosys.com` in Safari
2. Tap the **share** button (square with arrow, bottom center)
3. Scroll down, tap **"Add to Home Screen"**
4. Confirm the name "EdProSys"
5. The icon appears on your home screen

### What to Test After PWA Install

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| App opens from home screen | Yes, standalone (no address bar) | |
| Splash screen shows EdProSys brand | Dark purple background, logo | |
| Login works | Same as web | |
| Navigation works after login | Sidebar opens, pages load | |
| Go offline (airplane mode) → open app | Shows offline page, not blank | |
| Go back online → refresh | App recovers, data loads | |
| Notifications appear | If push configured, banner shows | |
| Orientation lock works | App stays portrait | |

---

## Testing the APK

### Building the APK

The APK is built via GitHub Actions. To trigger a build:

1. Go to https://github.com/PranixQuick/School-OS/actions
2. Find the "Android Build" workflow
3. Click "Run workflow" (or push a `v*` tag)
4. Wait for the build to complete (~5 minutes)
5. Download the APK artifact from the workflow run

### Installing the APK

1. Transfer the APK to your Android phone (email, Google Drive, or USB)
2. Open the APK file
3. Android will ask "Install from unknown sources?" → Allow
4. Install completes → open the app

### What to Test After APK Install

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| App opens | Shows EdProSys splash, then login | |
| Login works | Same as web | |
| WebView renders correctly | No blank pages, no CSS issues | |
| Back button works | Navigates back, doesn't exit app | |
| Keyboard behavior | Keyboard pushes content up, doesn't cover inputs | |
| Camera permission (if needed) | Prompts correctly | |
| App icon correct | EdProSys branded icon | |
| App name correct | "EdProSys" in app drawer | |

---

## Known Differences Between Web, PWA, and APK

| Feature | Web | PWA | APK |
|---------|-----|-----|-----|
| Address bar visible | Yes | No | No |
| Works offline | No | Basic (login page cached) | Basic |
| Push notifications | Browser permission needed | Supported | Supported |
| Auto-update | Instant | Next visit | Requires new APK |
| Safe area handling | Browser handles | Must be tested | Capacitor handles |
| Performance | Browser overhead | Slightly faster | Native WebView |

---

## Troubleshooting

| Problem | Mode | Fix |
|---------|------|-----|
| White/blank screen on open | PWA/APK | Clear cache, reinstall |
| "Service worker failed" | PWA | Hard refresh (pull down on mobile) |
| APK crashes on launch | APK | Check Android version (requires 8.0+) |
| Login fails in APK | APK | Check if `capacitor.config.ts` server URL matches production |
| Keyboard covers input | APK | Capacitor Keyboard plugin should handle this — report if not |
| Horizontal scroll | All | Report the page — it's a CSS bug |

---

## Operational Warnings

- **PWA installs cache aggressively** — if you update the site, users might see old versions until they refresh
- **APK needs Capacitor sync** — `npx cap sync android` must be run before building
- **iOS APK not available yet** — requires `npx cap add ios` on a Mac + Apple Developer enrollment
- **Service worker update** — when `sw.js` changes, existing PWA installs pick up changes on next visit (not immediate)
