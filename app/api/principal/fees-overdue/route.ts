// app/api/principal/fees-overdue/route.ts
// Item #6 PR #2 — Loop 2: overdue fees with intervention tracking.
//
// GET  /api/principal/fees-overdue — overdue + past-due-pending fees, joined with
//                                      student name + class/section + age (days past due)
// POST /api/principal/fees-overdue — mark intervention status. Body:
//   { id: uuid, intervention_status: 'notice_sent'|'parent_contacted'|'meeting_scheduled'|'resolved'|'escalated',
//     intervention_notes?: string }
// Uses the new fees.intervention_status / intervention_by / intervention_at columns
// added by migration item_6_pr2_fees_intervention_status.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = ['notice_sent', 'parent_contacted', 'meeting_scheduled', 'resolved', 'escalated'] as const;
type InterventionStatus = (typeof ALLOWED_STATUSES)[number];

interface InterventionBody {
  id: string;
  intervention_status: InterventionStatus;
  intervention_notes?: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidInterventionBody(b: unknown): b is InterventionBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    isUuid(o.id) &&
    typeof o.intervention_status === 'string' &&
    (ALLOWED_STATUSES as readonly string[]).includes(o.intervention_status) &&
    (o.intervention_notes === undefined || (typeof o.intervention_notes === 'string' && o.intervention_notes.length <= 1000))
  );
}

async function resolveCtx(req: NextRequest) {
  try { return { ctx: await requirePrincipalSession(req), errResp: null as null }; }
  catch (e) {
    if (e instanceof PrincipalAuthError) return { ctx: null, errResp: NextResponse.json({ error: e.message }, { status: e.status }) };
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { schoolId } = ctx!;

  // Fetch fees that are either status='overdue' OR (status='pending' AND due_date < today)
  const today = new Date().toISOString().split('T')[0];

  const { data: fees, error } = await supabaseAdmin
    .from('fees')
    .select('id, student_id, amount, fee_type, status, due_date, intervention_status, intervention_notes, intervention_at')
    .eq('school_id', schoolId)
    .in('status', ['overdue', 'pending'])
    .lte('due_date', today)
    .order('due_date', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hydrate with student name + class
  const studentIds = Array.from(new Set((fees ?? []).map((f) => f.student_id).filter(Boolean)));
  let studentMap: Record<string, { name: string; class: string; section: string }> = {};
  if (studentIds.length > 0) {
    const studentRes = await supabaseAdmin
      .from('students')
      .select('id, name, class, section')
      .in('id', studentIds)
      .eq('school_id', schoolId);
    if (studentRes.error) {
      return NextResponse.json({ error: studentRes.error.message }, { status: 500 });
    }
    studentMap = Object.fromEntries(
      (studentRes.data ?? []).map((s) => [s.id, { name: s.name, class: s.class, section: s.section }])
    );
  }

  const now = Date.now();
  const enriched = (fees ?? []).map((f) => {
    const dueMs = new Date(f.due_date).getTime();
    const daysPastDue = Math.floor((now - dueMs) / 86400000);
    const student = studentMap[f.student_id];
    return {
      ...f,
      student_name: student?.name ?? 'Unknown',
      class_label: student ? 'Grade ' + student.class + (student.section ? '-' + student.section : '') : '—',
      days_past_due: daysPastDue,
    };
  });

  const totalAmount = enriched.reduce((acc, f) => acc + Number(f.amount ?? 0), 0);
  const withIntervention = enriched.filter((f) => f.intervention_status).length;

  return NextResponse.json({
    total_count: enriched.length,
    total_amount: totalAmount,
    with_intervention_count: withIntervention,
    without_intervention_count: enriched.length - withIntervention,
    fees: enriched,
  });
}

export async function POST(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId: principalStaffId, schoolId } = ctx!;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidInterventionBody(body)) {
    return NextResponse.json(
      { error: 'Body must include id (uuid), intervention_status (notice_sent|parent_contacted|meeting_scheduled|resolved|escalated), optional intervention_notes (<=1000 chars)' },
      { status: 400 }
    );
  }

  // Verify fee exists in this school
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from('fees')
    .select('id')
    .eq('id', body.id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Fee record not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('fees')
    .update({
      intervention_status: body.intervention_status,
      intervention_notes: body.intervention_notes?.trim() ?? null,
      intervention_by: principalStaffId,
      intervention_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .eq('school_id', schoolId)
    .select('id, intervention_status, intervention_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fee: data });
}
