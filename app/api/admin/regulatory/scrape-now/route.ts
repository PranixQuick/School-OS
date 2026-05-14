// app/api/admin/regulatory/scrape-now/route.ts
// Batch 5A — Manually trigger the regulatory scraper Edge Function.
// Admin-only: cost-aware operation (calls Anthropic + external sites).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const DISPATCH_SECRET = process.env.DISPATCH_SECRET ?? '';

  if (!DISPATCH_SECRET) {
    return NextResponse.json({ error: 'DISPATCH_SECRET not configured' }, { status: 500 });
  }

  try {
    const scraperRes = await fetch(`${SUPABASE_URL}/functions/v1/regulatory-scraper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DISPATCH-SECRET': DISPATCH_SECRET,
      },
      body: JSON.stringify({ force: true }),
    });
    const data = await scraperRes.json();
    return NextResponse.json(data, { status: scraperRes.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
