// app/api/admin/library/route.ts
// Library management: simple issue-return workflow matching physical register
// Real workflow: librarian searches by accession number, issues book, records return
// No OPAC, no reservation system — these are manual in 99% of Indian schools
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

// GET: list items or overdue issues
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  const view = req.nextUrl.searchParams.get('view'); // 'items' | 'issues' | 'overdue'
  const search = req.nextUrl.searchParams.get('q');
  const instId = school?.institution_id ?? schoolId;

  if (view === 'issues' || view === 'overdue') {
    let q = supabaseAdmin
      .from('library_issues')
      .select('id, item_id, student_id, staff_id, borrower_type, issued_date, due_date, returned_date, fine_amount, fine_paid, status, item:item_id(title, accession_number, author), student:student_id(name, class, section)')
      .eq('institution_id', instId)
      .order('issued_date', { ascending: false })
      .limit(200);

    if (view === 'overdue') {
      const today = new Date().toISOString().split('T')[0];
      q = q.lt('due_date', today).is('returned_date', null).eq('status', 'issued');
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ issues: data ?? [] });
  }

  // Default: list items
  let q = supabaseAdmin
    .from('library_items')
    .select('id, accession_number, title, author, subject, category, total_copies, available_copies, is_active')
    .eq('institution_id', instId)
    .eq('is_active', true)
    .order('title')
    .limit(500);

  if (search) q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%,accession_number.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], count: (data ?? []).length });
}

// POST: add item to inventory OR issue a book
export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const instId = school?.institution_id ?? schoolId;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const actorEmail = req.headers.get('x-user-email') ?? 'librarian';

  if (body.action === 'issue') {
    // Issue a book to a student
    const { item_id, student_id, due_date } = body;
    if (!item_id || !student_id || !due_date) {
      return NextResponse.json({ error: 'item_id, student_id, due_date required' }, { status: 400 });
    }
    // Check availability
    const { data: item } = await supabaseAdmin
      .from('library_items').select('available_copies, title').eq('id', String(item_id)).maybeSingle();
    if (!item || item.available_copies < 1) {
      return NextResponse.json({ error: 'No copies available' }, { status: 400 });
    }
    // Create issue record
    const { data, error } = await supabaseAdmin.from('library_issues')
      .insert({
        institution_id: instId,
        school_id: schoolId,
        item_id: String(item_id),
        student_id: String(student_id),
        borrower_type: 'student',
        issued_date: new Date().toISOString().split('T')[0],
        due_date: String(due_date),
        issued_by: actorEmail,
        status: 'issued',
      })
      .select('id, item_id, student_id, issued_date, due_date').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Decrement available copies
    await supabaseAdmin.from('library_items')
      .update({ available_copies: item.available_copies - 1 })
      .eq('id', String(item_id));
    return NextResponse.json({ success: true, issue: data });
  }

  // Add item to inventory
  const { accession_number, title, author, subject, publisher, edition, isbn, category, total_copies } = body;
  if (!accession_number || !title) return NextResponse.json({ error: 'accession_number and title required' }, { status: 400 });

  const copies = Number(total_copies ?? 1);
  const { data, error } = await supabaseAdmin.from('library_items')
    .insert({
      institution_id: instId,
      school_id: schoolId,
      accession_number: String(accession_number).trim(),
      title: String(title).trim(),
      author: author ? String(author).trim() : null,
      subject: subject ? String(subject).trim() : null,
      publisher: publisher ? String(publisher).trim() : null,
      edition: edition ? String(edition).trim() : null,
      isbn: isbn ? String(isbn).trim() : null,
      category: category ? String(category).trim() : null,
      total_copies: copies,
      available_copies: copies,
      is_active: true,
    })
    .select('id, accession_number, title, available_copies').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}

// PATCH: return a book, update fine
export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const actorEmail = ctx.userEmail ?? req.headers.get('x-user-email') ?? 'librarian';
  const { id, action: libAction, fine_amount, fine_paid } = body;
  if (!id) return NextResponse.json({ error: 'id (issue id) required' }, { status: 400 });

  if (libAction === 'return') {
    const today = new Date().toISOString().split('T')[0];
    const { data: issue } = await supabaseAdmin
      .from('library_issues').select('item_id, status, due_date').eq('id', String(id)).maybeSingle();
    if (!issue || issue.status !== 'issued') {
      return NextResponse.json({ error: 'Issue not found or already returned' }, { status: 400 });
    }
    // Calculate fine: ₹2/day overdue (standard in most schools)
    const dueDate = new Date(issue.due_date);
    const returnDate = new Date(today);
    const overdueDays = Math.max(0, Math.floor((returnDate.getTime() - dueDate.getTime()) / 86400000));
    const calculatedFine = overdueDays * 2;

    await supabaseAdmin.from('library_issues').update({
      returned_date: today,
      status: 'returned',
      returned_by: actorEmail,
      fine_amount: calculatedFine > 0 ? calculatedFine : null,
    }).eq('id', String(id));

    // Restore available copies
    const { data: item } = await supabaseAdmin
      .from('library_items').select('available_copies, total_copies').eq('id', issue.item_id).maybeSingle();
    if (item) {
      await supabaseAdmin.from('library_items')
        .update({ available_copies: Math.min(item.available_copies + 1, item.total_copies) })
        .eq('id', issue.item_id);
    }

    return NextResponse.json({ success: true, overdue_days: overdueDays, fine_amount: calculatedFine });
  }

  // Update fine paid status
  if (fine_paid !== undefined) {
    await supabaseAdmin.from('library_issues')
      .update({ fine_paid: Boolean(fine_paid), fine_amount: fine_amount !== undefined ? Number(fine_amount) : undefined })
      .eq('id', String(id));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
