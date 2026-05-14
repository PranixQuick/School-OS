// app/api/admin/regulatory/sources/route.ts
// Batch 5A — List institution's mapped regulatory sources with stats.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ sources: [], configured: false });
  const institutionId = school.institution_id;

  const { data: mapped } = await supabaseAdmin
    .from('institution_source_map')
    .select('source_code, is_primary')
    .eq('institution_id', institutionId);

  if (!mapped?.length) return NextResponse.json({ sources: [], configured: false });

  const sourceCodes = mapped.map(m => m.source_code);
  const primaryMap = Object.fromEntries(mapped.map(m => [m.source_code, m.is_primary]));

  const { data: sources } = await supabaseAdmin
    .from('regulatory_sources')
    .select('source_code, display_name, base_url, last_scraped_at, scrape_interval_minutes, active')
    .in('source_code', sourceCodes)
    .order('display_name');

  // Notice count per source (last 30 days)
  const { data: counts } = await supabaseAdmin
    .from('regulatory_notices')
    .select('source_code')
    .in('source_code', sourceCodes)
    .gte('scraped_at', new Date(Date.now() - 30*24*60*60*1000).toISOString());

  const countMap: Record<string, number> = {};
  for (const r of counts ?? []) {
    countMap[r.source_code] = (countMap[r.source_code] ?? 0) + 1;
  }

  const result = (sources ?? []).map(s => ({
    ...s,
    is_primary: primaryMap[s.source_code] ?? false,
    recent_notices: countMap[s.source_code] ?? 0,
  }));

  return NextResponse.json({ sources: result, configured: true });
}
