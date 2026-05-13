// app/api/admin/data-subject-requests/route.ts
// Item #3 DPDP Compliance — PR #2
// POST: create a data subject request (export / deletion / correction / portability)
// GET:  list DSRs for this school with optional status filter
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const VALID_REQUESTER_TYPES = new Set(['parent','student','staff']);
const VALID_REQUEST_TYPES   = new Set(['export','deletion','correction','portability']);
const VALID_STATUSES        = new Set(['pending','in_progress','completed','rejected','all']);

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

// ─── POST: create DSR ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { requester_type, requester_id, request_type, notes } = (body as Record<string, unknown>);

  if (!VALID_REQUESTER_TYPES.has(requester_type as string)) return NextResponse.json({ error: `requester_type must be one of: ${[...VALID_REQUESTER_TYPES].join(', ')}` }, { status: 400 });
  if (!isUuid(requester_id)) return NextResponse.json({ error: 'requester_id (uuid) required' }, { status: 400 });
  if (!VALID_REQUEST_TYPES.has(request_type as string)) return NextResponse.json({ error: `request_type must be one of: ${[...VALID_REQUEST_TYPES].join(', ')}` }, { status: 400 });

  const { data: dsr, error } = await supabaseAdmin.from('data_subject_requests').insert({
    school_id: schoolId,
    requester_type,
    requester_id,
    request_type,
    notes: (notes as string | undefined) ?? null,
    status: 'pending',
  }).select('id, status, request_type, requester_type').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notification (best-effort, non-fatal)
  if (request_type === 'export' || request_type === 'deletion') {
    try {
      await supabaseAdmin.from('notifications').insert({
        school_id: schoolId, type: 'system',
        title: 'New data subject request',
        message: `A ${request_type} request has been submitted by ${requester_type}.`,
        target_count: 1, module: 'dsr', reference_id: dsr.id, status: 'pending', channel: 'whatsapp', attempts: 0,
      });
    } catch (e) { console.error('[dsr] notification failed (non-fatal):', e); }
  }

  return NextResponse.json({ request_id: dsr.id, status: dsr.status, request_type: dsr.request_type }, { status: 201 });
}

// ─── GET: list DSRs ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  const statusFilter = req.nextUrl.searchParams.get('status') ?? 'all';
  if (!VALID_STATUSES.has(statusFilter)) return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }, { status: 400 });

  let query = supabaseAdmin.from('data_subject_requests')
    .select('id, requester_type, requester_id, request_type, status, requested_at, completed_at, rejection_reason, export_url, notes')
    .eq('school_id', schoolId)
    .order('requested_at', { ascending: false });
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort requester name enrichment
  const enriched = await Promise.all((data ?? []).map(async dsr => {
    let requester_name: string | null = null;
    try {
      if (dsr.requester_type === 'parent') {
        const { data: p } = await supabaseAdmin.from('parents').select('name').eq('id', dsr.requester_id).eq('school_id', schoolId).maybeSingle();
        requester_name = p?.name ?? null;
      } else if (dsr.requester_type === 'student') {
        const { data: s } = await supabaseAdmin.from('students').select('name').eq('id', dsr.requester_id).eq('school_id', schoolId).maybeSingle();
        requester_name = s?.name ?? null;
      } else if (dsr.requester_type === 'staff') {
        const { data: st } = await supabaseAdmin.from('staff').select('name').eq('id', dsr.requester_id).eq('school_id', schoolId).maybeSingle();
        requester_name = st?.name ?? null;
      }
    } catch { /* non-fatal — enrichment is best-effort */ }
    return { ...dsr, requester_name };
  }));

  return NextResponse.json({ data_subject_requests: enriched, count: enriched.length, status_filter: statusFilter });
}
