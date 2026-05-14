// app/api/admin/regulatory/notices/route.ts
// Batch 5A — Fetch regulatory notices for institution's mapped sources.
// Query params: ?notice_type=X&priority=urgent|high&limit=20&offset=0
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
  if (!school?.institution_id) return NextResponse.json({ notices: [], total: 0, sources_configured: 0 });
  const institutionId = school.institution_id;

  // Get mapped sources
  const { data: mapped } = await supabaseAdmin
    .from('institution_source_map')
    .select('source_code')
    .eq('institution_id', institutionId);

  if (!mapped?.length) return NextResponse.json({ notices: [], total: 0, sources_configured: 0 });
  const sourceCodes = mapped.map(m => m.source_code);

  const { searchParams } = new URL(req.url);
  const noticeTypeFilter = searchParams.get('notice_type');
  const priorityFilter = searchParams.get('priority');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = supabaseAdmin
    .from('regulatory_notices')
    .select('*', { count: 'exact' })
    .in('source_code', sourceCodes);

  if (noticeTypeFilter) query = query.eq('notice_type', noticeTypeFilter);
  if (priorityFilter) query = query.eq('priority', priorityFilter);

  // Priority ordering: urgent → high → normal → low, then by scraped_at desc
  query = query
    .order('priority', { ascending: true }) // lexicographic: high < low < normal < urgent (not ideal)
    .order('scraped_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: noticesRaw, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort by priority weight client-side after fetch (supabase doesn't support CASE ordering)
  const PRIORITY_WEIGHT: Record<string, number> = { urgent: 1, high: 2, normal: 3, low: 4 };
  const notices = (noticesRaw ?? []).sort((a, b) =>
    (PRIORITY_WEIGHT[a.priority] ?? 5) - (PRIORITY_WEIGHT[b.priority] ?? 5)
  );

  // Get acknowledgement status for this institution
  if (notices.length) {
    const noticeIds = notices.map(n => n.id);
    const { data: deliveries } = await supabaseAdmin
      .from('institution_notice_deliveries')
      .select('notice_id')
      .eq('institution_id', institutionId)
      .in('notice_id', noticeIds);
    const ackSet = new Set((deliveries ?? []).map(d => d.notice_id));
    notices.forEach(n => { (n as Record<string, unknown>).acknowledged = ackSet.has(n.id); });
  }

  return NextResponse.json({ notices, total: count ?? 0, sources_configured: sourceCodes.length });
}
