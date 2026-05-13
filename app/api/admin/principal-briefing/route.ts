// app/api/admin/principal-briefing/route.ts
// Batch 5 — Fetch today's principal briefing (or by date).
// GET: ?date=YYYY-MM-DD (default today)
// Bridges the Batch 5 generate route with the principal dashboard.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return { schoolId: (await requireAdminSession(req)).schoolId }; }
  catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try { return { schoolId: (await requirePrincipalSession(req)).schoolId }; }
    catch (pe) { if (pe instanceof PrincipalAuthError) return null; throw pe; }
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('principal_briefings')
    .select('briefing_text, kpi_snapshot, generated_at, date')
    .eq('school_id', schoolId)
    .eq('date', date)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ briefing: data ?? null, date });
}
