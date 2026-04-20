// Phase 0 Task 0.5 — on-demand abuse digest endpoint.
// On Hobby plan this route is NOT wired to Vercel cron (Hobby caps at daily-only
// schedules, so we consolidate into /api/cron/abuse-monitor). It remains available
// for manual admin invocation with a Bearer CRON_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { runAbuseDigest } from '@/lib/abuse/digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await runAbuseDigest();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
