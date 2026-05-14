// app/api/owner/financials/route.ts
// Batch 4C — Cross-school fee collection summary + daily trend.
// fees.paid_date used for collection tracking.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireOwnerSession, OwnerAuthError } from '@/lib/owner-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireOwnerSession(req); }
  catch (e) { if (e instanceof OwnerAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolIds, schools } = ctx;

  if (!schoolIds.length) return NextResponse.json({ summary: [], trend: [], from: '', to: '' });

  const { searchParams } = new URL(req.url);
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10);
  const from = searchParams.get('from') ?? new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 10);

  const { data: fees, error } = await supabaseAdmin
    .from('fees')
    .select('school_id, fee_type, amount, status, paid_date, created_at')
    .in('school_id', schoolIds)
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const schoolNameMap = Object.fromEntries(schools.map(s => [s.school_id, s.school_name]));

  // Summary by school + fee_type
  const summaryMap: Record<string, { school_id: string; school_name: string; fee_type: string; collected: number; outstanding: number; paid_count: number }> = {};
  for (const f of fees ?? []) {
    const key = `${f.school_id}::${f.fee_type ?? 'other'}`;
    if (!summaryMap[key]) {
      summaryMap[key] = { school_id: f.school_id, school_name: schoolNameMap[f.school_id] ?? '?', fee_type: f.fee_type ?? 'other', collected: 0, outstanding: 0, paid_count: 0 };
    }
    const amt = Number(f.amount ?? 0);
    if (f.status === 'paid') { summaryMap[key].collected += amt; summaryMap[key].paid_count++; }
    if (f.status === 'pending' || f.status === 'overdue') summaryMap[key].outstanding += amt;
  }

  // Daily collection trend (paid fees by paid_date)
  const trendMap: Record<string, number> = {};
  for (const f of fees ?? []) {
    if (f.status === 'paid' && f.paid_date) {
      const day = f.paid_date.slice(0, 10);
      trendMap[day] = (trendMap[day] ?? 0) + Number(f.amount ?? 0);
    }
  }
  const trend = Object.entries(trendMap).sort(([a],[b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));

  return NextResponse.json({
    from, to,
    summary: Object.values(summaryMap).sort((a,b) => a.school_name.localeCompare(b.school_name) || a.fee_type.localeCompare(b.fee_type)),
    trend,
  });
}
