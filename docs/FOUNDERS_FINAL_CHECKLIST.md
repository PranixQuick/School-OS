# EdProSys — Founder's Final Checklist

---

## BEFORE FIRST DEMO (Prashanth)

- [ ] **Test parent login on phone:** `/parent/login` → Phone `9100000101` → PIN `1234` → verify child dashboard loads
- [ ] **Test student login on phone:** `/student/login` → Admission `SA-9-002` → PIN `5678` → verify student portal loads
- [ ] **Test admin login:** `demo.admin@suchitra.edprosys.demo` / `Demo@Suchitra#Admin2026` → dashboard loads with KPIs
- [ ] **Test teacher login:** `demo.teacher1@suchitra.edprosys.demo` / `Demo@Suchitra#Teacher2026` → teacher dashboard with schedule
- [ ] **Test principal login:** `principal@suchitracademy.edu.in` / `Demo@Suchitra#Principal2026` → briefing + leave approvals
- [ ] **Test language switch:** Login page → tap తె → labels change to Telugu → no layout break
- [ ] **Test PWA install:** Chrome → ⋮ → "Add to Home Screen" → app opens standalone
- [ ] **Run through demo script once:** Follow `docs/FOUNDER_DEMO_SCRIPT.md` end to end
- [ ] **Verify no horizontal scroll** on any page on phone

## BEFORE FIRST PILOT (Prashanth + Naveen + Gautham)

- [ ] **SMTP configured** (see `docs/SMTP_SETUP_GUIDE.md`) — required for staff invitations
- [ ] **Twilio configured** (see `docs/TWILIO_SETUP_GUIDE.md`) — required for parent WhatsApp
- [ ] **Razorpay test keys added** — required for online fee demo
- [ ] **One real school registered** via `/register` → completed 7-step onboarding
- [ ] **At least 3 staff** logged in and set passwords
- [ ] **At least 10 parents** received PINs and logged in
- [ ] **First attendance marked** by a real teacher on a real school day
- [ ] **Parent confirmed** they can see child's attendance on portal

## DAILY OPERATIONAL CHECKS

| Check | How | Frequency |
|-------|-----|-----------|
| Site is up | Open `https://www.edprosys.com` | Daily 8 AM |
| Cron jobs ran | Supabase → `cron_runs` table → latest entry within 24h | Daily |
| No build failures | GitHub → Actions → CI workflow → green | After every push |
| Vercel deployment healthy | Vercel → latest deployment → "Ready" status | Daily |

## WEEKLY OPERATIONAL CHECKS

| Check | How |
|-------|-----|
| Parent login still works | Login as test parent, verify data |
| Fee data accurate | Compare dashboard KPIs with known student count |
| No orphaned data | Check `students` without `parents` records |
| Supabase storage | Dashboard → Settings → Usage → database size |

## WHAT NAVEEN/GAUTHAM MUST MONITOR

- [ ] **Vercel deployment status** after every GitHub push
- [ ] **Supabase project health** — not paused, not approaching free tier limits
- [ ] **GitHub Actions** — CI passing on main branch
- [ ] **Twilio balance** — if configured, ensure credits don't run out
- [ ] **Domain renewal** — edprosys.com must not expire

## WHAT CAN WAIT UNTIL AFTER PILOT

- iOS App Store submission
- Google Search Console cleanup (gambling spam indexing)
- Teacher evaluation module (needs recordings)
- Razorpay live keys (test keys sufficient for pilot)
- Advanced analytics dashboard
- Custom report card templates
- Multi-school aggregation for owners with multiple schools
