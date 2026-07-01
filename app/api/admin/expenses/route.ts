// app/api/admin/expenses/route.ts
// API endpoint for listing and creating expenses / miscellaneous payments

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { writeNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const sp = req.nextUrl.searchParams;
  const category = sp.get('category');
  const type = sp.get('type');
  const status = sp.get('status');

  let query = supabaseAdmin
    .from('other_payments')
    .select('*, created_by:created_by(email), approved_by:approved_by(email)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (category) query = query.eq('category', category);
  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expenses: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, userId, userRole, userEmail } = ctx;

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { category, type, amount, description, payment_reference } = body;

  if (!category || !type || !amount) {
    return NextResponse.json({ error: 'category, type, and amount are required' }, { status: 400 });
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  // Determine initial status based on role
  // Owner and Admin roles auto-approve payments; Accountant-created transactions start as pending_approval
  const isAdminOrOwner = ['owner', 'admin', 'admin_staff', 'principal'].includes(userRole);
  const initialStatus = isAdminOrOwner ? 'approved' : 'pending_approval';

  const { data, error } = await supabaseAdmin
    .from('other_payments')
    .insert({
      school_id: schoolId,
      category,
      type,
      amount: numericAmount,
      description: description ?? null,
      status: initialStatus,
      created_by: userId,
      payment_reference: payment_reference ?? null,
      approved_by: isAdminOrOwner ? userId : null,
      approved_at: isAdminOrOwner ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger real-time system notification
  const title = initialStatus === 'approved' ? 'New Expense Approved' : 'New Expense Pending Approval';
  const message = `${category.toUpperCase()} payment of ₹${numericAmount} logged by ${userEmail}. Status: ${initialStatus}.`;
  
  await writeNotification(supabaseAdmin, {
    school_id: schoolId,
    type: 'alert',
    title,
    message,
    module: 'expense_created',
    reference_id: data.id,
  });

  return NextResponse.json({ success: true, id: data.id, status: initialStatus });
}
