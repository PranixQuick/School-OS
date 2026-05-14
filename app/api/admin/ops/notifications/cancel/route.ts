// app/api/admin/ops/notifications/cancel/route.ts
// Batch 12 — Cancel specific notifications by ID.
// Body: { notification_ids: uuid[] }
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

  const { notification_ids } = body as { notification_ids?: string[] };
  if (!notification_ids?.length) return NextResponse.json({ error: 'notification_ids required (non-empty array)' }, { status: 400 });
  if (notification_ids.length > 100) return NextResponse.json({ error: 'Max 100 IDs per request' }, { status: 400 });

  const { error, count } = await supabaseAdmin
    .from('notifications')
    .update({ status: 'cancelled' })
    .eq('school_id', schoolId)
    .in('id', notification_ids)
    .select('id', { count: 'exact', head: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cancelled: count ?? 0 });
}
