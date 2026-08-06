// app/api/admin/expenses/route.ts
// Outgoing payments / expense vouchers (workflow #7).
// GET  -> list this school's payments (newest first)
// POST -> accountant/admin creates a payment request (status pending_review) and
//         alerts principal + admin that a review is needed.
// Accountant is allowed here via ACCOUNTANT_ROUTE_ALLOWLIST (/api/admin/expenses).

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { createStaffAlerts } from '@/lib/alerts';

export const runtime = 'nodejs';

const CATEGORIES = ['vendor', 'utility', 'maintenance', 'salary_advance', 'other'];
const CREATE_ROLES = ['owner', 'admin', 'admin_staff', 'accountant'];

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { data, error } = await supabaseAdmin
    .from('outgoing_payments')
    .select('id, payee, amount, category, description, reference, status, notes, created_at, updated_at')
    .eq('school_id', ctx.schoolId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  if (!CREATE_ROLES.includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Your role cannot create payment requests' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { payee, amount, category, description, reference } = body as Record<string, any>;
  if (!payee || typeof payee !== 'string' || !amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: 'payee and a positive amount are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('outgoing_payments')
    .insert({
      school_id: ctx.schoolId,
      payee: String(payee).slice(0, 200),
      amount: Number(amount),
      category: CATEGORIES.includes(category) ? category : 'other',
      description: description ? String(description).slice(0, 1000) : null,
      reference: reference ? String(reference).slice(0, 200) : null,
      status: 'pending_review',
      created_by: ctx.userId,
    })
    .select('id, payee, amount, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await createStaffAlerts({
    schoolId: ctx.schoolId,
    targetRoles: ['principal', 'admin'],
    type: 'outgoing_payment',
    module: 'expenses',
    title: 'Payment approval needed',
    message: `A payment of ₹${Math.round(Number(amount))} to ${String(payee).slice(0, 80)} needs review.`,
    referenceId: data.id,
    href: '/admin/expenses',
  });

  return NextResponse.json({ payment: data }, { status: 201 });
}
