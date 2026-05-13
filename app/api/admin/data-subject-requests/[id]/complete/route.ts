// app/api/admin/data-subject-requests/[id]/complete/route.ts
// Item #3 DPDP Compliance — PR #2
// PATCH: mark DSR as completed or rejected.
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
    return { schoolId: ctx.schoolId, staffId: ctx.staffId };
  } catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try {
      const ctx = await requirePrincipalSession(req);
      return { schoolId: ctx.schoolId, staffId: ctx.staffId };
    } catch (pe) {
      if (pe instanceof PrincipalAuthError) return null;
      throw pe;
    }
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid DSR id' }, { status: 400 });

  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId, staffId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { action, export_url, rejection_reason } = (body as Record<string, unknown>);
  if (action !== 'complete' && action !== 'reject') return NextResponse.json({ error: "action must be 'complete' or 'reject'" }, { status: 400 });
  if (action === 'reject' && !rejection_reason) return NextResponse.json({ error: 'rejection_reason required when rejecting' }, { status: 400 });

  const { data: dsr } = await supabaseAdmin.from('data_subject_requests').select('id, status').eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (!dsr) return NextResponse.json({ error: 'DSR not found' }, { status: 404 });
  if (dsr.status === 'completed' || dsr.status === 'rejected') return NextResponse.json({ error: `DSR is already ${dsr.status}` }, { status: 409 });

  const { data: updated, error } = await supabaseAdmin.from('data_subject_requests').update({
    status: action === 'complete' ? 'completed' : 'rejected',
    completed_at: new Date().toISOString(),
    completed_by: staffId,
    export_url: (export_url as string | undefined) ?? null,
    rejection_reason: (rejection_reason as string | undefined) ?? null,
  }).eq('id', id).eq('school_id', schoolId)
    .select('id, status, completed_at, export_url, rejection_reason').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, dsr: updated });
}
