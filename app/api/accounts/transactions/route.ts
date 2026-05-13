// app/api/accounts/transactions/route.ts
// Item #12 — Accounts Dashboard
//
// GET /api/accounts/transactions
//   ?status=paid|pending|overdue|pending_verification|all  (default: all)
//   ?from=YYYY-MM-DD  (filter by paid_date or due_date)
//   ?to=YYYY-MM-DD
//   ?fee_type=tuition|transport|etc
//   ?limit=50  (max 100)
//   ?offset=0
//
// Auth: requireAdminSession (owner | principal | admin_staff | accountant)
// Returns: fees joined with students (name, class, section)
//
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['paid', 'pending', 'overdue', 'pending_verification', 'waived', 'all']);

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') ?? 'all';
  const from = searchParams.get('from') ?? null;
  const to = searchParams.get('to') ?? null;
  const feeType = searchParams.get('fee_type') ?? null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from('fees')
    .select(`
      id, student_id, amount, original_amount, due_date, paid_date,
      status, fee_type, description, fee_receipt_number,
      payment_method, payment_reference, discount_amount, gst_rate, tax_amount,
      created_at,
      students:student_id ( name, class, section )
    `)
    .eq('school_id', schoolId)
    .range(offset, offset + limit - 1);

  // Status filter
  if (status !== 'all') query = query.eq('status', status);

  // Fee type filter
  if (feeType) query = query.eq('fee_type', feeType);

  // Date range — for paid: filter by paid_date; for others: filter by due_date
  if (from || to) {
    const dateCol = status === 'paid' ? 'paid_date' : 'due_date';
    if (from) query = query.gte(dateCol, from);
    if (to) query = query.lte(dateCol, to);
  }

  // Order: paid fees by paid_date DESC, others by due_date ASC
  if (status === 'paid') {
    query = query.order('paid_date', { ascending: false });
  } else {
    query = query.order('due_date', { ascending: true });
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    transactions: data ?? [],
    count: (data ?? []).length,
    total: count ?? null,
    limit,
    offset,
    filters: { status, from, to, fee_type: feeType },
  });
}
