// app/api/admin/ops/notifications/dispatch/route.ts
// Batch 12 — Manually trigger the notifications dispatcher Edge Function.
// Requires DISPATCH_SECRET + NEXT_PUBLIC_SUPABASE_URL in Vercel env.
// DISPATCH_SECRET must match the Edge Function secret of the same name.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const dispatchSecret = process.env.DISPATCH_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!dispatchSecret) return NextResponse.json({ error: 'DISPATCH_SECRET not configured in Vercel env vars' }, { status: 503 });
  if (!supabaseUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL not configured' }, { status: 503 });

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/notifications-dispatcher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-DISPATCH-SECRET': dispatchSecret },
      body: '{}',
    });
    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json({ ok: res.ok, status: res.status, ...data });
  } catch (e) {
    return NextResponse.json({ error: `Dispatcher fetch failed: ${String(e)}` }, { status: 502 });
  }
}
