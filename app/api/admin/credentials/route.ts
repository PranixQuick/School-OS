// app/api/admin/credentials/route.ts
// Item #2 — Stakeholder login + bulk credential-send SMS.
//
// GET  /api/admin/credentials?class=<optional>
//        -> { classes: [{ class, total }], students?: [...] when class given }
// POST /api/admin/credentials   { scope, class?, student_ids?, send_parent, send_student, regenerate }
//        -> enqueues login-credential SMS via enqueue_login_credentials() RPC.
//
// Auth: requireAdminSession, then restricted to management roles
// (owner | principal | admin | admin_staff). Accountant/viewer/counsellor are denied —
// sending login credentials is an onboarding/admin action, not a fee action.
// Reuses the proven fee-SMS rail (notifications channel=sms -> cron -> MSG91 -> dispatch_log).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const MANAGE_ROLES = new Set(['owner', 'principal', 'admin', 'admin_staff']);

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function gate(req: NextRequest) {
  const ctx = await requireAdminSession(req);
  if (!MANAGE_ROLES.has(ctx.userRole)) {
    throw new AdminAuthError('Only an owner, principal or admin can send login credentials', 403);
  }
  return ctx;
}

// ─── GET: class list (+ students of a class for individual selection) ─────────
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await gate(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;
  const classLabel = req.nextUrl.searchParams.get('class');

  const { data: students, error } = await supabaseAdmin
    .from('students')
    .select('id, name, class, section, roll_number, is_active')
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const s of students ?? []) {
    const c = (s.class ?? '—') as string;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const classes = [...counts.entries()]
    .map(([cls, total]) => ({ class: cls, total }))
    .sort((a, b) => a.class.localeCompare(b.class, undefined, { numeric: true }));

  let inClass: Array<{ id: string; name: string; section: string | null; roll_number: string | null }> | undefined;
  if (classLabel) {
    inClass = (students ?? [])
      .filter(s => (s.class ?? '') === classLabel)
      .map(s => ({ id: s.id, name: s.name ?? '', section: s.section ?? null, roll_number: s.roll_number ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return NextResponse.json({ classes, total_students: (students ?? []).length, students: inClass });
}

// ─── POST: enqueue credential SMS ─────────────────────────────────────────────
interface SendBody {
  scope: 'all' | 'class' | 'students';
  class?: string;
  student_ids?: string[];
  send_parent?: boolean;
  send_student?: boolean;
  regenerate?: boolean;
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await gate(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: SendBody;
  try { body = await req.json() as SendBody; }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const sendParent = body.send_parent !== false; // default true
  const sendStudent = body.send_student === true; // default false
  if (!sendParent && !sendStudent) {
    return NextResponse.json({ error: 'Choose at least one of parent or student logins' }, { status: 400 });
  }

  // Resolve the target student ids from the chosen scope.
  let studentIds: string[] = [];
  if (body.scope === 'students') {
    const ids = (body.student_ids ?? []).filter(isUuid);
    if (ids.length === 0) return NextResponse.json({ error: 'No students selected' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('students').select('id')
      .eq('school_id', schoolId).eq('is_active', true).in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    studentIds = (data ?? []).map(s => s.id);
  } else if (body.scope === 'class') {
    if (!body.class) return NextResponse.json({ error: 'class is required for scope=class' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('students').select('id')
      .eq('school_id', schoolId).eq('is_active', true).eq('class', body.class);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    studentIds = (data ?? []).map(s => s.id);
  } else if (body.scope === 'all') {
    const { data, error } = await supabaseAdmin
      .from('students').select('id')
      .eq('school_id', schoolId).eq('is_active', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    studentIds = (data ?? []).map(s => s.id);
  } else {
    return NextResponse.json({ error: 'scope must be all, class or students' }, { status: 400 });
  }

  if (studentIds.length === 0) return NextResponse.json({ error: 'No matching students' }, { status: 404 });

  const { data: result, error: rpcError } = await supabaseAdmin.rpc('enqueue_login_credentials', {
    p_school: schoolId,
    p_student_ids: studentIds,
    p_send_parent: sendParent,
    p_send_student: sendStudent,
    p_regenerate: body.regenerate === true,
  });
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

  const r = (result ?? {}) as Record<string, number>;
  return NextResponse.json({
    ok: true,
    students_targeted: studentIds.length,
    parent_enqueued: r.parent_enqueued ?? 0,
    student_enqueued: r.student_enqueued ?? 0,
    parent_skipped: r.parent_skipped ?? 0,
    student_skipped: r.student_skipped ?? 0,
    note: 'Queued for SMS. Delivery runs on the dispatch cron once the MSG91 credentials template is configured.',
  });
}
