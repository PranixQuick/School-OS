// app/api/parent/fees/route.ts
// Item #2 — Fee Refactor + Parent Fee Visibility
//
// GET /api/parent/fees
// POST /api/parent/fees  (primary — carries phone+PIN auth)
//
// Auth: phone+PIN per request (Item 13 model — no session cookie for parents).
// Body: { phone: string, pin: string, status?: string }
// ?status query param also accepted for GET (browser convenience).
//
// Returns: fees for the parent's linked student, joined with student info.
// Read-only. No payment processing.
//
// TODO(item-15): migrate to supabaseForUser when parent auth moves to session model.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getInstitutionFlags } from '@/lib/institution-flags';

export const runtime = 'nodejs';

interface FeesRequest {
  phone?: string;
  pin?: string;
  status?: string;
}

const ALLOWED_STATUSES = new Set(['pending', 'paid', 'overdue', 'waived', 'partial']);

export async function POST(req: NextRequest) {
  let body: FeesRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  return handleFees(body);
}

// Also support GET with query params for convenience
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const body: FeesRequest = {
    phone: searchParams.get('phone') ?? undefined,
    pin: searchParams.get('pin') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  };
  return handleFees(body);
}

async function handleFees(body: FeesRequest) {
  if (!body.phone || !body.pin) {
    return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
  }

  const statusFilter = body.status && ALLOWED_STATUSES.has(body.status) ? body.status : null;

  // Re-auth parent (multi-tenant guard — matches pattern in attendance/homework routes)
  const { data: parents, error: pErr } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id, name, phone, language_pref')
    .eq('phone', body.phone)
    .eq('access_pin', body.pin);

  if (pErr) {
    console.error('[parent/fees] parent lookup error:', pErr);
    return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 });
  }
  if (!parents || parents.length === 0) {
    return NextResponse.json({ error: 'Invalid phone or PIN' }, { status: 401 });
  }
  if (parents.length > 1) {
    return NextResponse.json({ error: 'Multiple accounts match this phone. Contact your school admin.' }, { status: 409 });
  }

  const parent = parents[0];
  const { school_id: schoolId, student_id: studentId } = parent;

  // Fetch fees for this student, scoped to school
  let query = supabaseAdmin
    .from('fees')
    .select('id, student_id, amount, due_date, paid_date, status, fee_type, description, fee_receipt_number, gst_rate, tax_amount, created_at')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('due_date', { ascending: false })
    .limit(100);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data: fees, error: fErr } = await query;
  if (fErr) {
    console.error('[parent/fees] fees fetch error:', fErr);
    return NextResponse.json({ error: fErr.message }, { status: 500 });
  }

  // Fetch student info for display
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name, class, section')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  // Summary counts
  const summary: Record<string, number> = { pending: 0, paid: 0, overdue: 0, waived: 0, partial: 0 };
  let totalDue = 0;
  let totalPaid = 0;
  for (const f of fees ?? []) {
    const s = f.status ?? 'pending';
    summary[s] = (summary[s] ?? 0) + 1;
    const amt = Number(f.amount ?? 0);
    if (s === 'paid' || s === 'partial') totalPaid += amt;
    if (s === 'pending' || s === 'overdue') totalDue += amt;
  }

  // Check online payment flag for this school (Item #13)
  const flags = await getInstitutionFlags(schoolId);

  return NextResponse.json({
    student: {
      id: student?.id,
      name: student?.name ?? 'Unknown',
      class: student?.class ?? null,
      section: student?.section ?? null,
    },
    parent: { id: parent.id, name: parent.name },
    fees: fees ?? [],
    summary,
    total_due: totalDue,
    total_paid: totalPaid,
    fee_count: (fees ?? []).length,
    online_payment_enabled: flags.fee_module_enabled === true && flags.online_payment_enabled === true,
  });
}
