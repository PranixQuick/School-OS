// app/api/admin/transfer-certificates/[id]/route.ts
// Item #11 TC Lifecycle — PR #1
// GET: full TC detail + Section 65B event log
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid TC id' }, { status: 400 });

  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  // Fetch TC + student
  const { data: tc, error: tcErr } = await supabaseAdmin.from('transfer_certificates')
    .select(`
      id, status, fee_clearance_status, outstanding_fee_amount, reason, reason_category,
      requested_at, reviewed_at, issued_at, tc_number, rejection_reason,
      section_65b_logged, exit_completed,
      requested_by, reviewed_by, issued_by, fee_clearance_checked_by,
      fee_clearance_checked_at,
      students:student_id (
        id, name, class, section, admission_number, graduation_status,
        graduated_at, is_active, date_of_birth
      ),
      requester:requested_by ( email, name )
    `)
    .eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (tcErr) return NextResponse.json({ error: tcErr.message }, { status: 500 });
  if (!tc) return NextResponse.json({ error: 'TC not found' }, { status: 404 });

  // Fetch 65B event log
  const { data: events, error: evErr } = await supabaseAdmin.from('tc_section_65b_log')
    .select('id, event_type, event_at, performed_by, document_hash, metadata')
    .eq('tc_id', id).order('event_at', { ascending: true });
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });

  return NextResponse.json({ tc, events: events ?? [] });
}
