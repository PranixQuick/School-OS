// app/api/admin/fees/route.ts
// Item #13 — Admin fee management: list + create.
//
// GET  /api/admin/fees?status=&class=&student_id=&limit=&offset=
// POST /api/admin/fees { student_id, amount, due_date, fee_type, description }
//
// Auth: requireAdminSession (owner | principal | admin_staff | accountant)
// Institution gate: fee_module_enabled
//
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient'; // TODO(item-15): migrate to supabaseForUser
import { supabaseForUser as _supabaseForUser } from '@/lib/supabaseForUser'; // I3: factory registered

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const feeEnabled = await isFeeModuleEnabled(schoolId);
  if (!feeEnabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') ?? null;
  const classLabel = searchParams.get('class') ?? null;
  const studentId = searchParams.get('student_id') ?? null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  // Fetch fees with student info. Soft-deleted (cancelled) fees never appear in any list.
  let query = supabaseAdmin
    .from('fees')
    .select(`id, student_id, amount, original_amount, due_date, paid_date, status, fee_type,
      description, fee_receipt_number, gst_rate, tax_amount, payment_method, payment_reference,
      payment_screenshot_url, payment_verified_at, discount_amount, discount_reason,
      intervention_status, created_at,
      students:student_id ( name, class, section, phone_parent )`)
    .eq('school_id', schoolId)
    .eq('is_deleted', false)
    .order('due_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (studentId && isUuid(studentId)) query = query.eq('student_id', studentId);

  const { data: fees, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Client-side class filter (students.class is TEXT, not indexed with fees)
  const filtered = classLabel
    ? (fees ?? []).filter((f) => {
        const s = f.students as { class?: string } | null;
        return s?.class === classLabel;
      })
    : (fees ?? []);

  // Summary
  const summary: Record<string, number> = {};
  for (const f of filtered) {
    summary[f.status ?? 'pending'] = (summary[f.status ?? 'pending'] ?? 0) + 1;
  }

  // viewer_role lets the UI gate owner-only controls (e.g. discounts) before the server does.
  return NextResponse.json({ fees: filtered, summary, total: count ?? filtered.length, limit, offset, viewer_role: ctx.userRole });
}

// ─── POST ───────────────────────────────────────────────────────────────────
interface CreateFeeBody {
  student_id: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  fee_type?: string;
  description?: string;
}

function isValidCreate(b: unknown): b is CreateFeeBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    isUuid(o.student_id) &&
    typeof o.amount === 'number' && o.amount > 0 &&
    typeof o.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.due_date)
  );
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId, staffId, userId, userRole } = ctx;

  const feeEnabled = await isFeeModuleEnabled(schoolId);
  if (!feeEnabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidCreate(body)) {
    return NextResponse.json(
      { error: 'Body must include student_id (uuid), amount (positive number), due_date (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  // Verify student belongs to this school
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', body.student_id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!student) return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('fees')
    .insert({
      school_id: schoolId,
      student_id: body.student_id,
      amount: body.amount,
      original_amount: body.amount,
      due_date: body.due_date,
      fee_type: body.fee_type ?? 'tuition',
      description: body.description ?? null,
      status: 'pending',
    })
    .select('id, student_id, amount, due_date, status, fee_type')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit: who created this fee (purpose is the description / fee_type).
  try {
    await supabaseAdmin.from('audit_log').insert({
      school_id: schoolId,
      user_id: userId ?? null,
      action: 'fee.create',
      op: 'INSERT',
      resource: 'fees',
      resource_id: data.id,
      old_data: null,
      new_data: data,
      metadata: { by_role: userRole, by_staff: staffId ?? null, description: body.description ?? null },
      ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
      user_agent: req.headers.get('user-agent') ?? null,
    });
  } catch (auditErr) { console.error('[fees POST] audit_log write failed (non-fatal):', auditErr); }

  return NextResponse.json({ fee: data }, { status: 201 });
}
