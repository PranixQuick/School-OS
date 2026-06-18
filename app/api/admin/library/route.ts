// app/api/admin/library/route.ts
// Real workflow: librarian adds books by accession number, issues to students, marks returned
// Simple record-keeping only. No OPAC, no MARC, no complex cataloguing.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { canDo } from '@/lib/permissions';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ items: [] });

  const view    = req.nextUrl.searchParams.get('view') ?? 'items';
  const search  = req.nextUrl.searchParams.get('q');
  const limit   = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100'), 500);

  if (view === 'issues') {
    const status = req.nextUrl.searchParams.get('status') ?? 'issued';
    let q = supabaseAdmin.from('library_issues')
      .select('*, item:library_items(accession_number, title, author), student:students(name, class, section)')
      .eq('institution_id', school.institution_id)
      .order('issued_date', { ascending: false })
      .limit(limit);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ issues: data ?? [] });
  }

  if (view === 'overdue') {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin.from('library_issues')
      .select('*, item:library_items(accession_number, title), student:students(name, class, phone_parent)')
      .eq('institution_id', school.institution_id)
      .eq('status', 'issued')
      .lt('due_date', today)
      .order('due_date', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ overdue: data ?? [], count: (data ?? []).length });
  }

  // Default: items
  let q = supabaseAdmin.from('library_items')
    .select('id, accession_number, title, author, subject, category, total_copies, available_copies')
    .eq('institution_id', school.institution_id)
    .eq('is_active', true)
    .order('title')
    .limit(limit);
  if (search) q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%,accession_number.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], count: (data ?? []).length });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { action: 'add_item' | 'issue' | 'return' | 'mark_overdue'; [key: string]: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  if (body.action === 'add_item') {
    const { accession_number, title, author, subject, category, total_copies, isbn } = body as any;
    if (!accession_number || !title) return NextResponse.json({ error: 'accession_number and title required' }, { status: 400 });
    const copies = total_copies ?? 1;
    const { data, error } = await supabaseAdmin.from('library_items').insert({
      institution_id: school.institution_id, school_id: schoolId,
      accession_number, title, author: author ?? null, subject: subject ?? null,
      category: category ?? 'other', isbn: isbn ?? null,
      total_copies: copies, available_copies: copies,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, item: data });
  }

  if (body.action === 'issue') {
    const { item_id, student_id, due_date, issued_by } = body as any;
    if (!item_id || !student_id || !due_date) return NextResponse.json({ error: 'item_id, student_id, due_date required' }, { status: 400 });
    // Check availability
    const { data: item } = await supabaseAdmin.from('library_items').select('available_copies, title').eq('id', item_id).maybeSingle();
    if (!item || item.available_copies < 1) return NextResponse.json({ error: 'Book not available' }, { status: 422 });
    const { data, error } = await supabaseAdmin.from('library_issues').insert({
      institution_id: school.institution_id, school_id: schoolId,
      item_id, student_id,
      issued_date: new Date().toISOString().split('T')[0],
      due_date, issued_by: issued_by ?? null,
      status: 'issued',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, issue: data });
  }

  if (body.action === 'return') {
    const { issue_id, fine_amount, fine_paid } = body as any;
    if (!issue_id) return NextResponse.json({ error: 'issue_id required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('library_issues').update({
      status: 'returned',
      returned_date: new Date().toISOString().split('T')[0],
      fine_amount: fine_amount ?? null,
      fine_paid: fine_paid ?? false,
    }).eq('id', issue_id).eq('institution_id', school.institution_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
