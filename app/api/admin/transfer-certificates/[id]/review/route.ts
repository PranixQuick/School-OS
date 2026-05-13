// app/api/admin/transfer-certificates/[id]/review/route.ts
// Item #11 TC Lifecycle — PR #1
// PATCH: principal approves or rejects TC
// Auth: requirePrincipalSession ONLY (principal gate)
// Guard: fee clearance must be cleared/waived before approval
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid TC id' }, { status: 400 });

  let ctx;
  try { ctx = await requirePrincipalSession(req); }
  catch (e) {
    if (e instanceof PrincipalAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, staffId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { action, rejection_reason } = (body as Record<string, unknown>);
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }
  if (action === 'reject' && (!rejection_reason || typeof rejection_reason !== 'string' || !(rejection_reason as string).trim())) {
    return NextResponse.json({ error: 'rejection_reason required when rejecting' }, { status: 400 });
  }

  // Fetch TC
  const { data: tc } = await supabaseAdmin.from('transfer_certificates')
    .select('id, status, fee_clearance_status, student_id')
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (!tc) return NextResponse.json({ error: 'TC not found' }, { status: 404 });
  if (tc.status !== 'pending') return NextResponse.json({ error: `TC status is '${tc.status}', expected 'pending'` }, { status: 409 });

  // GUARD: fee clearance required before approval
  if (action === 'approve' && tc.fee_clearance_status === 'pending') {
    return NextResponse.json({
      error: 'fee_clearance_required',
      message: 'Outstanding fees must be cleared or waived before approving TC.',
    }, { status: 400 });
  }

  const now = new Date().toISOString();
  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  const { data: updated, error } = await supabaseAdmin.from('transfer_certificates')
    .update({
      status: newStatus,
      reviewed_by: staffId,
      reviewed_at: now,
      rejection_reason: action === 'reject' ? (rejection_reason as string).trim() : null,
      updated_at: now,
    })
    .eq('id', id).eq('school_id', schoolId)
    .select('id, status, reviewed_at, rejection_reason').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 65B event log
  await supabaseAdmin.rpc('log_tc_event', {
    p_tc_id: id, p_school_id: schoolId, p_student_id: tc.student_id,
    p_event_type: action === 'approve' ? 'tc_approved' : 'tc_revoked',
    p_performed_by: staffId, p_doc_hash: null,
    p_metadata: { action, ...(action === 'reject' ? { rejection_reason } : {}) },
  });

  // Notification on approval (best-effort, non-fatal)
  if (action === 'approve') {
    try {
      const { data: student } = await supabaseAdmin.from('students').select('name')
        .eq('id', tc.student_id).maybeSingle();
      await supabaseAdmin.from('notifications').insert({
        school_id: schoolId, type: 'system',
        title: 'TC approved — ready for issuance',
        message: `TC for ${student?.name ?? 'student'} approved. Ready to issue.`,
        target_count: 1, module: 'tc', reference_id: id, status: 'pending', channel: 'whatsapp', attempts: 0,
      });
    } catch (e) { console.error('[tc] approval notification failed (non-fatal):', e); }
  }

  return NextResponse.json({ success: true, tc: updated });
}
