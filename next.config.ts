// /next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

export default nextConfig;
```

---

## ENV VARIABLES — Add to Vercel

Go to **Vercel → school-os-rh47 → Settings → Environment Variables** and add:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Claude API key from console.anthropic.com |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rqdnxdvuypekpmxbteju.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API → service_role key |

---

## MANUAL STEPS (mobile-friendly)

**Step 1 — Add packages**
In your GitHub repo, open `package.json` → add `"pdfkit": "^0.15.0"` and `"jszip": "^3.10.1"` to dependencies → commit.

**Step 2 — Add all 7 files** to the repo at the exact paths shown above.

**Step 3 — Add env variables on Vercel**
- Go to vercel.com → your project `school-os-rh47`
- Settings → Environment Variables
- Add the 3 keys above → Save

**Step 4 — Trigger deploy**
Vercel auto-deploys when you push to GitHub. Wait ~90 seconds.

**Step 5 — Test**
Open `https://school-os-rh47.vercel.app/report-cards`
- Select **Class 5 – A** / **Term 1 2024-25**
- Click **Generate Report Cards with AI**
- Wait ~30 seconds
- ZIP downloads with 5 PDFs

---

Your internal API key (save this):
```
sk_schoolos_5816d56abd8e5a3d6387756bcb7de006a5f5dd3a19c25596
