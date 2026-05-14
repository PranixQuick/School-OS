// app/api/admin/rte/lottery/route.ts
// Batch 4B — RTE lottery draw. Fisher-Yates shuffle.
// Guard: confirmed=true, no prior lottery run.
// Assigns lottery_number 1..N, marks top rte_seats as lottery_selected, rest as waitlisted.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { academic_year_id, confirmed } = body as { academic_year_id?: string; confirmed?: boolean };
  if (!confirmed) return NextResponse.json({ error: 'confirmed=true required to run lottery' }, { status: 400 });
  if (!academic_year_id) return NextResponse.json({ error: 'academic_year_id required' }, { status: 400 });

  // Guard: no lottery already run
  const { data: existing } = await supabaseAdmin
    .from('rte_applications')
    .select('id')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academic_year_id)
    .not('lottery_number', 'is', null)
    .limit(1);
  if (existing?.length) return NextResponse.json({ error: 'Lottery has already been run for this year' }, { status: 409 });

  // Fetch seat config for rte_seats count
  const { data: config } = await supabaseAdmin
    .from('rte_seat_config')
    .select('rte_seats')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academic_year_id)
    .maybeSingle();
  if (!config) return NextResponse.json({ error: 'No RTE seat config found for this academic year. Set up seats first.' }, { status: 404 });

  // Fetch all 'applied' applications
  const { data: apps, error } = await supabaseAdmin
    .from('rte_applications')
    .select('id')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academic_year_id)
    .eq('status', 'applied');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const appIds = (apps ?? []).map(a => a.id);
  const N = appIds.length;
  if (!N) return NextResponse.json({ error: 'No applications in "applied" status to run lottery on' }, { status: 400 });

  // Fisher-Yates shuffle of lottery numbers 1..N
  const nums = Array.from({ length: N }, (_, i) => i + 1);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }

  const rteSeatCount = config.rte_seats;

  // Batch update: assign lottery_number and new status
  const updates = appIds.map((id, idx) => ({
    id,
    lottery_number: nums[idx],
    status: nums[idx] <= rteSeatCount ? 'lottery_selected' : 'waitlisted',
  }));

  // Update each application
  for (const u of updates) {
    await supabaseAdmin
      .from('rte_applications')
      .update({ lottery_number: u.lottery_number, status: u.status })
      .eq('id', u.id)
      .eq('school_id', schoolId);
  }

  const selected = updates.filter(u => u.status === 'lottery_selected').length;
  const waitlisted = updates.filter(u => u.status === 'waitlisted').length;

  return NextResponse.json({
    total_applications: N,
    selected,
    waitlisted,
    rte_seats: rteSeatCount,
  });
}
