import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyCronAuth } from '@/lib/cron-auth';
import { env } from '@/lib/env';

// Vercel calls this daily at 2am UTC via vercel.json crons config.
// Phase E: fan-out pattern — fires one non-awaited request per active school
// so each school gets its own 300s Vercel budget. The orchestrator finishes in <5s.
// Auth is delegated to verifyCronAuth.

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const { data: schools, error } = await supabaseAdmin
    .from('schools')
    .select('id, name, plan')
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  // Fire-and-forget: one fetch per school, no await
  for (const school of schools ?? []) {
    void fetch(`${appUrl}/api/cron/run-school`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CRON_SECRET ?? ''}`
      },
      body: JSON.stringify({
        school_id: school.id,
        school_name: school.name,
        plan: school.plan,
      }),
    }).catch(err => console.error(`[Cron Daily] dispatch failed for ${school.id}:`, err));
  }

  return NextResponse.json({
    dispatched: schools?.length ?? 0,
    schools: schools?.map(s => s.name) ?? [],
  });
}
