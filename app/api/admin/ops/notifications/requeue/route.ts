// app/api/admin/ops/notifications/requeue/route.ts
// Batch 12 — Re-queue stuck notifications back to pending.
// Body: { status_filter: 'failed'|'awaiting_template'|'skipped'|'all' }
// 'all' re-queues failed+awaiting_template+skipped (never touches dispatched).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const REQUEUEABLE = ['failed', 'awaiting_template', 'skipped'] as const;

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { status_filter } = body as { status_filter?: string };
  if (!status_filter || !['failed','awaiting_template','skipped','all'].includes(status_filter))
    return NextResponse.json({ error: 'status_filter must be failed, awaiting_template, skipped, or all' }, { status: 400 });

  const statuses = status_filter === 'all' ? [...REQUEUEABLE] : [status_filter as typeof REQUEUEABLE[number]];

  const { error, count } = await supabaseAdmin
    .from('notifications')
    .update({ status: 'pending', attempts: 0, dispatch_error: null, last_attempt_at: null })
    .eq('school_id', schoolId)
    .in('status', statuses)
    .select('id', { count: 'exact', head: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requeued: count ?? 0 });
}
