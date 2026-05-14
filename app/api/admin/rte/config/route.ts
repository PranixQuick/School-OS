// app/api/admin/rte/config/route.ts
// Batch 4B — RTE seat configuration read/write.
// academic_years uses .label (not .name).
// schools uses .slug (not .code) for cert number generation.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function checkRteEnabled(schoolId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('schools').select('institutions(feature_flags)').eq('id', schoolId).maybeSingle();
  const inst = data ? (Array.isArray(data.institutions) ? data.institutions[0] : data.institutions) as { feature_flags?: Record<string, unknown> } | null : null;
  return !!(inst?.feature_flags?.rte_mode_enabled);
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  if (!(await checkRteEnabled(schoolId))) {
    return NextResponse.json({ error: 'RTE mode is not enabled for this institution' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearId = searchParams.get('year');

  // Get seat config
  let configQuery = supabaseAdmin
    .from('rte_seat_config')
    .select('*, academic_years(label)')
    .eq('school_id', schoolId);
  if (yearId) configQuery = configQuery.eq('academic_year_id', yearId);
  else configQuery = configQuery.order('created_at', { ascending: false }).limit(1);
  const { data: config } = await configQuery.maybeSingle();

  // Application counts by status
  const { data: appCounts } = await supabaseAdmin
    .from('rte_applications')
    .select('status')
    .eq('school_id', schoolId)
    .eq('academic_year_id', config?.academic_year_id ?? yearId ?? '');

  const counts: Record<string, number> = {};
  for (const r of appCounts ?? []) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }

  return NextResponse.json({
    config: config ?? null,
    applications: {
      applied: counts['applied'] ?? 0,
      lottery_selected: counts['lottery_selected'] ?? 0,
      admitted: counts['admitted'] ?? 0,
      waitlisted: counts['waitlisted'] ?? 0,
      rejected: counts['rejected'] ?? 0,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    },
  });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  if (!(await checkRteEnabled(schoolId))) {
    return NextResponse.json({ error: 'RTE mode is not enabled for this institution' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { entry_class, total_seats, academic_year_id } = body as { entry_class?: string; total_seats?: number; academic_year_id?: string };
  if (!total_seats || !academic_year_id) return NextResponse.json({ error: 'total_seats and academic_year_id required' }, { status: 400 });

  const rte_seats = Math.ceil(total_seats * 0.25);

  const { data, error } = await supabaseAdmin
    .from('rte_seat_config')
    .upsert({
      school_id: schoolId,
      academic_year_id,
      entry_class: entry_class ?? 'Class 1',
      total_seats,
      rte_seats,
    }, { onConflict: 'school_id,academic_year_id' })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
