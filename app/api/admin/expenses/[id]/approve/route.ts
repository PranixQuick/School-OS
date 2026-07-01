// app/api/admin/expenses/[id]/approve/route.ts
// Approval API route for approving / rejecting / marking payments

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { writeNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, userId, userRole, userEmail } = ctx;

  // Gate: Only Owner / Admin / Principal can approve expense transactions
  const isAdminOrOwner = ['owner', 'admin', 'admin_staff', 'principal'].includes(userRole);
  if (!isAdminOrOwner) {
    return NextResponse.json({ error: 'Only owners or administrators can approve transactions' }, { status: 403 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { status, payment_reference } = body;
  if (!status || !['approved', 'rejected', 'paid'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved, rejected, or paid' }, { status: 400 });
  }

  // Fetch the current transaction details to verify it exists and belongs to the same school
  const { data: txn, error: fetchError } = await supabaseAdmin
    .from('other_payments')
    .select('*')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (fetchError || !txn) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('other_payments')
    .update({
      status,
      approved_by: userId,
      approved_at: new Date().toISOString(),
      payment_reference: payment_reference ?? txn.payment_reference,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('category, amount')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger system notification for the stakeholder
  const title = `Expense ${status.charAt(0).toUpperCase() + status.slice(1)}`;
  const message = `${data.category.toUpperCase()} payment of ₹${data.amount} has been marked as ${status} by ${userEmail}.`;

  await writeNotification(supabaseAdmin, {
    school_id: schoolId,
    type: 'alert',
    title,
    message,
    module: 'expense_approved',
    reference_id: id,
  });

  return NextResponse.json({ success: true, status });
}
