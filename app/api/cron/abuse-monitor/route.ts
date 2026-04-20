// Phase 0 Task 0.5 — consolidated daily abuse cron.
// Vercel Hobby plan limits crons to once-per-day schedules, so all abuse work
// is consolidated into this single endpoint. On Pro plan, switch vercel.json
// to schedule the individual watcher routes at their ideal frequencies
// (every 5 min for watchers, hourly for sweeps, daily for digest).
//
// Runs in this order:
//   1. login anomaly watcher  (last 5 min window)
//   2. webhook spam watcher   (last 5-60 min windows per signal)
//   3. webhook_rate_log sweep (deletes buckets >24h old)
//   4. blocked_ips sweep      (deletes expired blocks)
//   5. abuse digest           (emails founder)

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { runLoginAnomalyWatch } from '@/lib/abuse/login-watcher';
import { runWebhookSpamWatch } from '@/lib/abuse/webhook-watcher';
import { runAbuseDigest } from '@/lib/abuse/digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const started = Date.now();

  const login = await runLoginAnomalyWatch();
  const webhook = await runWebhookSpamWatch();

  const { data: rateSweepCount, error: rateSweepErr } =
    await supabaseAdmin.rpc('webhook_rate_sweep');
  const { data: blockSweepCount, error: blockSweepErr } =
    await supabaseAdmin.rpc('blocked_ips_sweep');

  const digest = await runAbuseDigest();

  return NextResponse.json({
    ok: true,
    ms: Date.now() - started,
    login,
    webhook,
    rate_sweep: {
      deleted: typeof rateSweepCount === 'number' ? rateSweepCount : 0,
      error: rateSweepErr?.message,
    },
    block_sweep: {
      deleted: typeof blockSweepCount === 'number' ? blockSweepCount : 0,
      error: blockSweepErr?.message,
    },
    digest,
  });
}
