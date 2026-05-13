// app/api/admin/fees/refunds/route.ts
// Batch 8 — List all fees with non-none refund_status for this school.
// Auth: requireAdminSession.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data, error } = await supabaseAdmin
    .from('fees')
    .select('id, fee_type, amount, refund_amount, refund_status, refund_at, razorpay_refund_id, payment_reference, student_id, students(name, class, section)')
    .eq('school_id', schoolId)
    .neq('refund_status', 'none')
    .order('refund_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ refunds: data ?? [] });
}
