// app/api/principal/tc-queue/route.ts
// Item #11 TC Lifecycle — PR #2
// GET: count of TCs ready for principal approval (fee cleared/waived, status=pending)
// Used by principal dashboard KPI card.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requirePrincipalSession(req); }
  catch (e) {
    if (e instanceof PrincipalAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const { count, error } = await supabaseAdmin
    .from('transfer_certificates')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('status', 'pending')
    .in('fee_clearance_status', ['cleared', 'waived']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pending_approval_count: count ?? 0 });
}
