// app/api/parent/fees/activity/route.ts
// Parent-facing notices about changes to THEIR child's fees (updated / removed / paid /
// waived), so the parent app reflects staff actions promptly. Parent-session gated.
// The staff's internal reason/purpose is deliberately NOT exposed to parents.
//
// GET /api/parent/fees/activity?since=<ISO>

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

export const runtime = 'nodejs';

const LABEL: Record<string, string> = {
  'fee.amend': 'updated',
  'fee.delete': 'removed',
  'fee.mark_paid': 'marked paid',
  'fee.waive': 'waived',
};

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The student's fee ids (incl. soft-deleted, so a 'removed' notice still resolves).
  const { data: fees } = await supabaseAdmin
    .from('fees')
    .select('id')
    .eq('school_id', session.schoolId)
    .eq('student_id', session.studentId);
  const ids = (fees ?? []).map((f) => f.id);
  if (!ids.length) return NextResponse.json({ events: [], server_time: new Date().toISOString() });

  const since = req.nextUrl.searchParams.get('since');
  let q = supabaseAdmin
    .from('audit_log')
    .select('id, action, resource_id, new_data, old_data, created_at')
    .eq('school_id', session.schoolId)
    .eq('resource', 'fees')
    .in('resource_id', ids)
    .in('action', ['fee.amend', 'fee.delete', 'fee.mark_paid', 'fee.waive'])
    .order('created_at', { ascending: false })
    .limit(20);
  if (since) q = q.gt('created_at', since);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = (rows ?? []).map((r) => {
    const nd = (r.new_data ?? {}) as Record<string, unknown>;
    const od = (r.old_data ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      at: r.created_at as string,
      label: LABEL[r.action as string] ?? 'changed',
      fee_type: (nd.fee_type ?? od.fee_type ?? null) as string | null,
      amount: (nd.amount ?? od.amount ?? null) as number | null,
    };
  });

  return NextResponse.json({ events, server_time: new Date().toISOString() });
}
