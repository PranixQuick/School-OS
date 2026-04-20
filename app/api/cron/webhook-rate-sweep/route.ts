// Phase 0 Task 0.5 — hourly sweep of webhook_rate_log (+ blocked_ips TTL).
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: sweepData, error: sweepErr } = await supabaseAdmin.rpc('webhook_rate_sweep');
  const { data: blockData, error: blockErr } = await supabaseAdmin.rpc('blocked_ips_sweep');

  return NextResponse.json({
    ok: !sweepErr && !blockErr,
    webhook_rate_log_deleted: typeof sweepData === 'number' ? sweepData : 0,
    blocked_ips_deleted: typeof blockData === 'number' ? blockData : 0,
    sweep_error: sweepErr?.message,
    block_sweep_error: blockErr?.message,
  });
}
