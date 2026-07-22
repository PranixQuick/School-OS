// app/api/principal/extras/route.ts
// Returns operational extras for the principal dashboard extras row.
// Fast aggregations — all from existing tables.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['principal','admin','owner'].includes(session.userRole)) return NextResponse.json({ error: 'Principal role required' }, { status: 403 });

  const sid = session.schoolId;

  // Resolve school ids (supporting both UUID and legacy_school_id)
  const { data: inst } = await supabaseAdmin
    .from('institutions')
    .select('id, legacy_school_id, settings')
    .or(`id.eq.${sid},legacy_school_id.eq.${sid}`)
    .maybeSingle();

  const instId = inst?.id || sid;
  const legacyId = inst?.legacy_school_id;
  const settings = (inst?.settings ?? {}) as Record<string, unknown>;
  const isGovt = settings.school_mode === 'govt_high_school' || settings.school_mode === 'govt_primary';

  // Construct OR query for school_id
  const schoolOrFilter = `school_id.eq.${instId}${legacyId ? `,school_id.eq.${legacyId}` : ''}`;

  const [leaveRes, complaintsRes, proofsRes, sanitaryRes] = await Promise.allSettled([
    supabaseAdmin.from('teacher_leave_requests').select('id', { count: 'exact', head: true }).or(schoolOrFilter).eq('status', 'pending'),
    supabaseAdmin.from('parent_complaints').select('id', { count: 'exact', head: true }).or(schoolOrFilter).in('status', ['open', 'pending']),
    supabaseAdmin.from('classroom_proofs').select('id', { count: 'exact', head: true }).or(schoolOrFilter).eq('eval_status', 'pending').gte('taken_at', new Date(Date.now() - 7*86400000).toISOString()),
    supabaseAdmin.from('sanitary_inventory').select('id', { count: 'exact', head: true }).or(schoolOrFilter).filter('stock_count', 'lte', 10),
  ]);

  return NextResponse.json({
    pending_leave_count:      leaveRes.status === 'fulfilled' ? (leaveRes.value.count ?? 0) : 0,
    open_complaints_count:    complaintsRes.status === 'fulfilled' ? (complaintsRes.value.count ?? 0) : 0,
    proofs_to_review_count:   proofsRes.status === 'fulfilled' ? (proofsRes.value.count ?? 0) : 0,
    sanitary_low_stock_count: sanitaryRes.status === 'fulfilled' ? (sanitaryRes.value.count ?? 0) : 0,
    transport_alert_count:    0, // future: trip_attendance anomalies
    govt_reporting_pending:   isGovt && new Date().getDate() >= 25, // DISE window
  });
}
