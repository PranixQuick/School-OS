// app/api/admin/library/issues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const overdue = req.nextUrl.searchParams.get('overdue') === 'true';
  const today   = new Date().toISOString().split('T')[0];
  let q = supabaseAdmin.from('library_issues')
    .select('id, status, issued_date, due_date, returned_date, fine_amount, item:item_id(title), student:student_id(name, class)')
    .eq('school_id', session.schoolId)
    .order('issued_date', { ascending: false })
    .limit(100);
  if (overdue) q = q.eq('status', 'issued').lt('due_date', today);
  else q = q.eq('status', 'issued');
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ issues: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { item_id?: string; student_id?: string; due_date?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.item_id || !body?.student_id) return NextResponse.json({ error: 'item_id and student_id required' }, { status: 400 });
  // Check availability
  const { data: item } = await supabaseAdmin.from('library_items').select('available_copies').eq('id', body.item_id).single();
  if (!item || item.available_copies < 1) return NextResponse.json({ error: 'Book not available' }, { status: 409 });
  const { data, error } = await supabaseAdmin.from('library_issues').insert({
    school_id: session.schoolId,
    item_id: body.item_id,
    student_id: body.student_id,
    borrower_type: 'student',
    issued_date: new Date().toISOString().split('T')[0],
    due_date: body.due_date ?? new Date(Date.now() + 14*86400000).toISOString().split('T')[0],
    status: 'issued',
    issued_by: session.userId,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Decrement available_copies
  await supabaseAdmin.from('library_items').update({ available_copies: item.available_copies - 1 }).eq('id', body.item_id);
  return NextResponse.json({ success: true, issue: data });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { id?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { data: issue } = await supabaseAdmin.from('library_issues').select('due_date, item_id').eq('id', body.id).eq('school_id', session.schoolId).single();
  if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  const today = new Date();
  const due   = new Date(issue.due_date);
  const fine  = today > due ? Math.floor((today.getTime() - due.getTime()) / 86400000) * 2 : 0; // ₹2/day
  await supabaseAdmin.from('library_issues').update({ status: 'returned', returned_date: today.toISOString().split('T')[0], fine_amount: fine, returned_by: session.userId }).eq('id', body.id);
  // Restore available_copies
  const { data: item } = await supabaseAdmin.from('library_items').select('available_copies').eq('id', issue.item_id).single();
  if (item) await supabaseAdmin.from('library_items').update({ available_copies: item.available_copies + 1 }).eq('id', issue.item_id);
  return NextResponse.json({ success: true, fine_amount: fine });
}
