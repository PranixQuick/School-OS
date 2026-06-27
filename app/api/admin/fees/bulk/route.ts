// app/api/admin/fees/bulk/route.ts
// Bulk fee assignment -- create one fee item for MANY students in a single call.
// This is the admin/accountant "add an item to all or individual parents" flow.
//
// GET  /api/admin/fees/bulk?mode=all|class|section|institution|students&...   -> { matched }
//        preview: returns how many active students the target resolves to (no writes)
// POST /api/admin/fees/bulk { fee_type, amount, due_date, description?, target } -> { created, skipped, matched }
//
//   target =
//     { mode: 'all' }
//   | { mode: 'class', class, section? }
//   | { mode: 'institution', institution_id }
//   | { mode: 'students', student_ids: string[] }
//
// Auth: requireAdminSession (owner | principal | admin_staff | accountant).
//   Accountant is permitted because this path is under /api/admin/fees, which is
//   in ACCOUNTANT_ROUTE_ALLOWLIST (lib/authz.ts).
// Gate: isFeeModuleEnabled(schoolId).
// Safety: every query is scoped to the caller's schoolId; a double-click never
//   double-charges -- students already holding an identical OPEN fee (same
//   fee_type + due_date + amount, not yet paid) are skipped.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { FEE_TYPE_KEYS } from '@/lib/fee-catalog';

export const runtime = 'nodejs';

const isUuid = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

type Target =
  | { mode: 'all' }
  | { mode: 'class'; class: string; section?: string }
  | { mode: 'institution'; institution_id: string }
  | { mode: 'students'; student_ids: string[] };

// Build the school-scoped, active-only student query for a target. Returns an
// error string if the target shape is invalid.
function studentQueryForTarget(schoolId: string, target: Target) {
  let q = supabaseAdmin
    .from('students')
    .select('id', { count: 'exact' })
    .eq('school_id', schoolId)
    .eq('is_active', true);

  switch (target?.mode) {
    case 'all':
      return { q };
    case 'class':
      if (!target.class) return { err: 'class is required for mode=class' };
      q = q.eq('class', target.class);
      if (target.section) q = q.eq('section', target.section);
      return { q };
    case 'institution':
      if (!isUuid(target.institution_id)) return { err: 'institution_id (uuid) is required' };
      q = q.eq('institution_id', target.institution_id);
      return { q };
    case 'students':
      if (!Array.isArray(target.student_ids) || target.student_ids.length === 0 || !target.student_ids.every(isUuid))
        return { err: 'student_ids must be a non-empty array of uuids' };
      q = q.in('id', target.student_ids);
      return { q };
    default:
      return { err: 'unknown target.mode' };
  }
}

async function auth(req: NextRequest) {
  const ctx = await requireAdminSession(req);
  if (!(await isFeeModuleEnabled(ctx.schoolId))) {
    throw new AdminAuthError('fee_module_disabled', 403);
  }
  return ctx;
}

// --- GET (preview count) -----------------------------------------------------
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await auth(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const sp = req.nextUrl.searchParams;
  const mode = sp.get('mode') ?? '';
  const target = {
    mode,
    class: sp.get('class') ?? undefined,
    section: sp.get('section') ?? undefined,
    institution_id: sp.get('institution_id') ?? undefined,
    student_ids: sp.get('student_ids') ? sp.get('student_ids')!.split(',').filter(Boolean) : undefined,
  } as unknown as Target;

  const { q, err } = studentQueryForTarget(ctx.schoolId, target);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const { count, error } = await q!;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matched: count ?? 0 });
}

// --- POST (assign) -----------------------------------------------------------
interface BulkBody {
  fee_type: string;
  amount: number;
  due_date: string;
  description?: string;
  target: Target;
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await auth(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: BulkBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body?.due_date ?? ''))
    return NextResponse.json({ error: 'due_date must be YYYY-MM-DD' }, { status: 400 });

  const feeType = (body?.fee_type ?? '').trim().toLowerCase() || 'tuition';
  if (!FEE_TYPE_KEYS.includes(feeType))
    return NextResponse.json({ error: `Unknown fee_type '${feeType}'` }, { status: 400 });

  const { q, err } = studentQueryForTarget(schoolId, body?.target);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const { data: students, error: sErr } = await q!;
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const ids = (students ?? []).map((s) => s.id);
  if (ids.length === 0)
    return NextResponse.json({ created: 0, skipped: 0, matched: 0, message: 'No matching students' });

  // Idempotent double-click guard: skip students who already hold an identical OPEN fee.
  const { data: dupes } = await supabaseAdmin
    .from('fees')
    .select('student_id')
    .eq('school_id', schoolId)
    .eq('fee_type', feeType)
    .eq('due_date', body.due_date)
    .eq('amount', amount)
    .in('student_id', ids)
    .neq('status', 'paid');

  const skip = new Set((dupes ?? []).map((d) => d.student_id));
  const toInsert = ids
    .filter((id) => !skip.has(id))
    .map((id) => ({
      school_id: schoolId,
      student_id: id,
      amount,
      original_amount: amount,
      due_date: body.due_date,
      fee_type: feeType,
      description: body.description?.trim() || null,
      status: 'pending',
      data_source: 'admin_bulk',
    }));

  if (toInsert.length === 0)
    return NextResponse.json({
      created: 0, skipped: skip.size, matched: ids.length,
      message: 'All targeted students already have this fee',
    });

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('fees')
    .insert(toInsert)
    .select('id');
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json(
    { created: inserted?.length ?? 0, skipped: skip.size, matched: ids.length, fee_type: feeType },
    { status: 201 },
  );
}
