// Phase 0 Task 0.5 — login anomaly watch cron (every 5 min).
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { runLoginAnomalyWatch } from '@/lib/abuse/login-watcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await runLoginAnomalyWatch();
  return NextResponse.json({ ok: true, ...result });
}
