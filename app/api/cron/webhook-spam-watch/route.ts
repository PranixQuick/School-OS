// Phase 0 Task 0.5 — webhook spam watch cron (every 5 min).
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { runWebhookSpamWatch } from '@/lib/abuse/webhook-watcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await runWebhookSpamWatch();
  return NextResponse.json({ ok: true, ...result });
}
