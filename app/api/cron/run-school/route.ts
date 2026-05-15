import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { runAllJobsForSchool } from '@/lib/cronEngine';
import { verifyCronAuth } from '@/lib/cron-auth';

// Internal per-school cron worker.
// Called by /api/cron/daily (fire-and-forget) — one invocation per active school.
// Phase E: fan-out pattern. Each school gets its own 300s Vercel function budget.

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  let school_id: string, school_name: string, plan: string;
  try {
    const body = await req.json() as { school_id?: string; school_name?: string; plan?: string };
    school_id = body.school_id ?? '';
    school_name = body.school_name ?? 'unknown';
    plan = body.plan ?? 'free';
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!school_id) {
    return NextResponse.json({ error: 'school_id required' }, { status: 400 });
  }

  // Idempotency guard: skip if a cron run is already in-flight for this school
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: running } = await supabaseAdmin
    .from('cron_runs')
    .select('id')
    .eq('school_id', school_id)
    .eq('status', 'running')
    .gte('started_at', tenMinutesAgo)
    .limit(1);

  if (running && running.length > 0) {
    return NextResponse.json({ skipped: true, reason: 'already running' });
  }

  const school = { id: school_id, name: school_name, plan };
  const results = await runAllJobsForSchool(school, 'auto');

  return NextResponse.json({
    success: true,
    school: school_name,
    jobs_run: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  });
}
