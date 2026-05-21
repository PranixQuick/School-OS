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

  const [leaveRes, complaintsRes, proofsRes, sanitaryRes] = await Promise.allSettled([
    supabaseAdmin.from('teacher_leave_requests').select('id', { count: 'exact', head: true }).eq('school_id', sid).eq('status', 'pending'),
    supabaseAdmin.from('parent_complaints').select('id', { count: 'exact', head: true }).eq('school_id', sid).in('status', ['open', 'pending']),
    supabaseAdmin.from('classroom_proofs').select('id', { count: 'exact', head: true }).eq('school_id', sid).eq('eval_status', 'pending').gte('taken_at', new Date(Date.now() - 7*86400000).toISOString()),
    supabaseAdmin.from('sanitary_inventory').select('id', { count: 'exact', head: true }).eq('school_id', sid).filter('stock_count', 'lte', 10),
  ]);

  // Institution mode check for govt reporting
  const { data: inst } = await supabaseAdmin.from('institutions').select('settings').eq('legacy_school_id', sid).single();
  const isGovt = inst?.settings?.school_mode === 'govt_high_school' || inst?.settings?.school_mode === 'govt_primary';

  return NextResponse.json({
    pending_leave_count:      leaveRes.status === 'fulfilled' ? (leaveRes.value.count ?? 0) : 0,
    open_complaints_count:    complaintsRes.status === 'fulfilled' ? (complaintsRes.value.count ?? 0) : 0,
    proofs_to_review_count:   proofsRes.status === 'fulfilled' ? (proofsRes.value.count ?? 0) : 0,
    sanitary_low_stock_count: sanitaryRes.status === 'fulfilled' ? (sanitaryRes.value.count ?? 0) : 0,
    transport_alert_count:    0, // future: trip_attendance anomalies
    govt_reporting_pending:   isGovt && new Date().getDate() >= 25, // DISE window
  });
}
