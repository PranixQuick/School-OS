// app/api/admin/substitute-assignments/route.ts
// Item #10 — Substitute Teacher Automation
//
// GET  /api/admin/substitute-assignments?date=YYYY-MM-DD&status=pending|confirmed|cancelled
// POST /api/admin/substitute-assignments
//
// Auth: requireAdminSession or requirePrincipalSession
// Institution gate: none (substitute management is always available)
//
// NOTE ON SUBSTITUTE NOTIFICATIONS:
// The notifications-dispatcher (Item #14) resolves recipients via parents table.
// It cannot target a specific staff member by staff_id. Substitute WhatsApp
// notifications are therefore sent via DIRECT Twilio API call in this route,
// bypassing the dispatcher. This is flagged here for Item #15.2 when the dispatcher
// gets a staff-targeted module.
// TODO(future): add 'substitute_assigned' module to dispatcher with staff phone resolution.
//
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM ?? '';

async function resolveSession(req: NextRequest): Promise<{ schoolId: string; userId: string; staffId: string | null } | null> {
  try {
    const ctx = await requireAdminSession(req);
    return { schoolId: ctx.schoolId, userId: ctx.userId, staffId: ctx.staffId };
  } catch (adminErr) {
    if (!(adminErr instanceof AdminAuthError)) throw adminErr;
    try {
      const ctx = await requirePrincipalSession(req);
      return { schoolId: ctx.schoolId, userId: ctx.session.userId, staffId: ctx.staffId };
    } catch (principalErr) {
      if (principalErr instanceof PrincipalAuthError) return null;
      throw principalErr;
    }
  }
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  const { searchParams } = req.nextUrl;
  const dateFilter = searchParams.get('date') ?? todayIST();
  const statusFilter = searchParams.get('status') ?? null;

  let query = supabaseAdmin
    .from('substitute_assignments')
    .select(`
      id, original_class_id, original_staff_id, substitute_staff_id,
      reason, date, status, assigned_at, accepted_at, leave_request_id,
      original_staff:original_staff_id ( name, role ),
      substitute_staff:substitute_staff_id ( name, phone ),
      class:original_class_id ( grade_level, section )
    `)
    .eq('school_id', schoolId)
    .eq('date', dateFilter)
    .order('assigned_at', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assignments: data ?? [], date: dateFilter, count: (data ?? []).length });
}

// ─── POST ───────────────────────────────────────────────────────────────────
interface CreateBody {
  original_class_id: string;
  original_staff_id: string;
  substitute_staff_id: string;
  reason: string;
  date?: string;
  leave_request_id?: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidCreate(b: unknown): b is CreateBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    isUuid(o.original_class_id) && isUuid(o.original_staff_id) && isUuid(o.substitute_staff_id) &&
    typeof o.reason === 'string' && o.reason.trim().length > 0 &&
    (o.date === undefined || (typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date))) &&
    (o.leave_request_id === undefined || isUuid(o.leave_request_id))
  );
}

async function sendSubstituteWhatsApp(
  substitutePhone: string | null | undefined,
  substituteName: string,
  className: string,
  date: string,
  originalTeacherName: string,
): Promise<void> {
  if (!substitutePhone || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.log('[substitute/assign] Twilio not configured or no phone — skipping WhatsApp notification');
    return;
  }

  const message = `Hi ${substituteName}, you are covering ${className} on ${date} for ${originalTeacherName}. Please confirm receipt.`;
  const to = substitutePhone.startsWith('whatsapp:') ? substitutePhone : `whatsapp:${substitutePhone}`;

  const form = new URLSearchParams();
  form.append('From', TWILIO_WHATSAPP_FROM);
  form.append('To', to);
  form.append('Body', message);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error('[substitute/assign] Twilio send failed:', res.status, errText.slice(0, 200));
    } else {
      console.log('[substitute/assign] WhatsApp sent to', substituteName);
    }
  } catch (err) {
    console.error('[substitute/assign] Twilio fetch error:', err);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId, userId, staffId } = ctx;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidCreate(body)) {
    return NextResponse.json(
      { error: 'Body must include original_class_id, original_staff_id, substitute_staff_id, reason (string). Optional: date (YYYY-MM-DD), leave_request_id.' },
      { status: 400 }
    );
  }

  const assignDate = body.date ?? todayIST();

  // Validate all staff + class belong to this school
  const [classRow, origStaff, subStaff] = await Promise.all([
    supabaseAdmin.from('classes').select('id, grade_level, section').eq('id', body.original_class_id).eq('school_id', schoolId).maybeSingle(),
    supabaseAdmin.from('staff').select('id, name').eq('id', body.original_staff_id).eq('school_id', schoolId).maybeSingle(),
    supabaseAdmin.from('staff').select('id, name, phone').eq('id', body.substitute_staff_id).eq('school_id', schoolId).eq('is_active', true).maybeSingle(),
  ]);

  if (!classRow.data) return NextResponse.json({ error: 'Class not found in this school' }, { status: 404 });
  if (!origStaff.data) return NextResponse.json({ error: 'Original teacher not found in this school' }, { status: 404 });
  if (!subStaff.data) return NextResponse.json({ error: 'Substitute teacher not found or inactive' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('substitute_assignments')
    .insert({
      school_id: schoolId,
      original_class_id: body.original_class_id,
      original_staff_id: body.original_staff_id,
      substitute_staff_id: body.substitute_staff_id,
      reason: body.reason.trim(),
      date: assignDate,
      assigned_by: staffId ?? userId,
      assigned_at: new Date().toISOString(),
      status: 'pending',
      leave_request_id: body.leave_request_id ?? null,
    })
    .select('id, status, date')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Direct WhatsApp notification to substitute (dispatcher cannot target specific staff)
  const className = `Grade ${classRow.data.grade_level}${classRow.data.section ? '-' + classRow.data.section : ''}`;
  try {
    await sendSubstituteWhatsApp(
      subStaff.data.phone,
      subStaff.data.name,
      className,
      assignDate,
      origStaff.data.name,
    );
  } catch (notifErr) {
    console.error('[substitute/assign] notification failed (non-fatal):', notifErr);
  }

  return NextResponse.json({
    success: true,
    assignment_id: data.id,
    date: data.date,
    class: className,
    substitute: subStaff.data.name,
  });
}
