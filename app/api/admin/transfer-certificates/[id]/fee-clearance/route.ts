// app/api/admin/transfer-certificates/[id]/fee-clearance/route.ts
// Item #11 TC Lifecycle — PR #1
// PATCH: mark fee clearance as cleared or waived
// Auth: requireAdminSession or requirePrincipalSession
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function resolveSession(req: NextRequest) {
  try {
    const ctx = await requireAdminSession(req);
    return { schoolId: ctx.schoolId, userId: ctx.userId, staffId: ctx.staffId };
  } catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try {
      const ctx = await requirePrincipalSession(req);
      return { schoolId: ctx.schoolId, userId: ctx.session.userId, staffId: ctx.staffId };
    } catch (pe) {
      if (pe instanceof PrincipalAuthError) return null;
      throw pe;
    }
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid TC id' }, { status: 400 });

  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId, staffId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const action = (body as Record<string, unknown>)?.action;
  if (action !== 'clear' && action !== 'waive') {
    return NextResponse.json({ error: "action must be 'clear' or 'waive'" }, { status: 400 });
  }

  // Fetch TC for auth + state check
  const { data: tc } = await supabaseAdmin.from('transfer_certificates')
    .select('id, status, student_id, fee_clearance_status')
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (!tc) return NextResponse.json({ error: 'TC not found' }, { status: 404 });
  if (tc.status !== 'pending') return NextResponse.json({ error: `Cannot update fee clearance on TC with status '${tc.status}'` }, { status: 409 });

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin.from('transfer_certificates')
    .update({
      fee_clearance_status: action === 'clear' ? 'cleared' : 'waived',
      fee_clearance_checked_by: staffId,
      fee_clearance_checked_at: now,
      updated_at: now,
    })
    .eq('id', id).eq('school_id', schoolId)
    .select('id, status, fee_clearance_status, fee_clearance_checked_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 65B event log
  await supabaseAdmin.rpc('log_tc_event', {
    p_tc_id: id, p_school_id: schoolId, p_student_id: tc.student_id,
    p_event_type: 'fee_cleared', p_performed_by: staffId,
    p_doc_hash: null, p_metadata: { action },
  });

  return NextResponse.json({ success: true, tc: updated });
}
