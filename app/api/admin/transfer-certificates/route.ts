// app/api/admin/transfer-certificates/route.ts
// Item #11 TC Lifecycle — PR #1
// POST: create TC request with duplicate guard + fee dues check + 65B event log
// GET:  list TCs with optional status filter
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

const VALID_REASON_CATEGORIES = new Set(['transfer','graduation','family_relocation','fee_default','disciplinary','other']);
const VALID_STATUSES = new Set(['pending','approved','issued','rejected','revoked','all']);

async function resolveSession(req: NextRequest): Promise<{ schoolId: string; userId: string; staffId: string | null } | null> {
  try {
    const ctx = await requireAdminSession(req);
    return { schoolId: ctx.schoolId, userId: ctx.userId, staffId: ctx.staffId };
  } catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try {
      const ctx = await requirePrincipalSession(req);
      return { schoolId: ctx.schoolId, userId: ctx.session.userId, staffId: ctx.staffId };
    } catch (pe) {
      if (pe instanceof PrincipalAuthError) return null;
      throw pe;
    }
  }
}

// ─── POST: Create TC request ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId, userId, staffId } = ctx;

  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { student_id, reason, reason_category } = (body as Record<string, unknown>);

  if (!isUuid(student_id)) return NextResponse.json({ error: 'student_id (uuid) required' }, { status: 400 });
  if (!reason || typeof reason !== 'string' || !reason.trim()) return NextResponse.json({ error: 'reason required' }, { status: 400 });
  if (!VALID_REASON_CATEGORIES.has(reason_category as string)) {
    return NextResponse.json({ error: `reason_category must be one of: ${[...VALID_REASON_CATEGORIES].join(', ')}` }, { status: 400 });
  }

  // Verify student belongs to school
  const { data: student } = await supabaseAdmin.from('students').select('id, name, class, section')
    .eq('id', student_id).eq('school_id', schoolId).maybeSingle();
  if (!student) return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });

  // Resolve requesting school_user id
  const { data: schoolUser } = await supabaseAdmin.from('school_users').select('id')
    .eq('school_id', schoolId).eq('auth_user_id', userId).maybeSingle();
  if (!schoolUser) return NextResponse.json({ error: 'Requesting user not found in school' }, { status: 403 });

  // GUARD: duplicate pending/approved TC
  const { data: existing } = await supabaseAdmin.from('transfer_certificates').select('id, status')
    .eq('student_id', student_id).eq('school_id', schoolId).in('status', ['pending','approved']).limit(1);
  if ((existing ?? []).length > 0) {
    return NextResponse.json({
      error: 'tc_already_pending',
      message: 'An active TC request already exists for this student.',
      existing_id: (existing as {id:string}[])[0].id,
    }, { status: 409 });
  }

  // FEE DUES CHECK
  const { data: feeData } = await supabaseAdmin.from('fees')
    .select('amount, discount_amount')
    .eq('student_id', student_id).eq('school_id', schoolId)
    .in('status', ['pending','overdue']);
  const outstanding = (feeData ?? []).reduce((sum, f) => {
    return sum + (Number(f.amount ?? 0) - Number(f.discount_amount ?? 0));
  }, 0);
  const feeClearanceStatus = outstanding > 0 ? 'pending' : 'cleared';

  // Resolve current academic year via institution join
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  let academicYearId: string | null = null;
  if (school?.institution_id) {
    const { data: ay } = await supabaseAdmin.from('academic_years').select('id')
      .eq('institution_id', school.institution_id).eq('status', 'active').limit(1).maybeSingle();
    academicYearId = ay?.id ?? null;
  }

  // INSERT TC
  const { data: tc, error: insertErr } = await supabaseAdmin.from('transfer_certificates').insert({
    school_id: schoolId,
    student_id,
    academic_year_id: academicYearId,
    requested_by: schoolUser.id,
    requested_at: new Date().toISOString(),
    reason: (reason as string).trim(),
    reason_category: reason_category as string,
    fee_clearance_status: feeClearanceStatus,
    outstanding_fee_amount: outstanding,
    status: 'pending',
  }).select('id, status, fee_clearance_status, outstanding_fee_amount').single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 65B event log
  await supabaseAdmin.rpc('log_tc_event', {
    p_tc_id: tc.id, p_school_id: schoolId, p_student_id: student_id,
    p_event_type: 'tc_requested', p_performed_by: staffId,
    p_doc_hash: null, p_metadata: { reason_category, outstanding_fee_amount: outstanding },
  });

  // Notification if fees outstanding (best-effort, non-fatal)
  if (feeClearanceStatus === 'pending') {
    try {
      await supabaseAdmin.from('notifications').insert({
        school_id: schoolId, type: 'alert',
        title: `TC request: outstanding fees for ${student.name}`,
        message: `TC requested for ${student.name}. ₹${Math.round(outstanding)} outstanding. Clear fees to proceed.`,
        target_count: 1, module: 'tc', reference_id: tc.id, status: 'pending', channel: 'whatsapp', attempts: 0,
      });
    } catch (e) { console.error('[tc] notification failed (non-fatal):', e); }
  }

  return NextResponse.json({
    tc_id: tc.id,
    status: tc.status,
    fee_clearance_status: tc.fee_clearance_status,
    outstanding_fee_amount: outstanding,
    student_name: student.name,
  }, { status: 201 });
}

// ─── GET: List TCs ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  const statusFilter = req.nextUrl.searchParams.get('status') ?? 'all';
  if (!VALID_STATUSES.has(statusFilter)) {
    return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }, { status: 400 });
  }

  let query = supabaseAdmin.from('transfer_certificates')
    .select(`
      id, status, fee_clearance_status, outstanding_fee_amount, reason, reason_category,
      requested_at, reviewed_at, issued_at, tc_number, rejection_reason,
      students:student_id ( name, class, section, admission_number ),
      requester:requested_by ( email )
    `)
    .eq('school_id', schoolId)
    .order('requested_at', { ascending: false });

  if (statusFilter !== 'all') query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transfer_certificates: data ?? [], count: (data ?? []).length, status_filter: statusFilter });
}
