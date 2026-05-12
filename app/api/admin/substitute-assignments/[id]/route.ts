// app/api/admin/substitute-assignments/[id]/route.ts
// Item #10 — Substitute Teacher Automation
//
// PATCH /api/admin/substitute-assignments/:id
//
// Auth: requireAdminSession or requirePrincipalSession
// Body: { status: 'confirmed' | 'cancelled' }
//
// On cancelled: sends direct Twilio WhatsApp cancellation notification to substitute.
// (Dispatcher cannot target specific staff by id — see POST route for full explanation.)
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

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function sendCancellationWhatsApp(substitutePhone: string | null | undefined, substituteName: string, className: string, date: string): Promise<void> {
  if (!substitutePhone || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) return;
  const message = `Hi ${substituteName}, your substitute assignment for ${className} on ${date} has been cancelled. Please disregard the earlier message.`;
  const to = substitutePhone.startsWith('whatsapp:') ? substitutePhone : `whatsapp:${substitutePhone}`;
  const form = new URLSearchParams();
  form.append('From', TWILIO_WHATSAPP_FROM); form.append('To', to); form.append('Body', message);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (!res.ok) { const t = await res.text(); console.error('[substitute/cancel] Twilio error:', res.status, t.slice(0, 200)); }
  } catch (err) { console.error('[substitute/cancel] Twilio fetch error:', err); }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });

  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const status = (body as Record<string, unknown>)?.status;
  if (status !== 'confirmed' && status !== 'cancelled') {
    return NextResponse.json({ error: 'status must be confirmed or cancelled' }, { status: 400 });
  }

  // Fetch assignment for notification context
  const { data: assignment, error: fetchErr } = await supabaseAdmin
    .from('substitute_assignments')
    .select(`
      id, status, date,
      substitute_staff:substitute_staff_id ( name, phone ),
      class:original_class_id ( grade_level, section )
    `)
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (assignment.status === status) return NextResponse.json({ error: `Assignment is already ${status}` }, { status: 409 });

  const updatePatch: Record<string, unknown> = { status };
  if (status === 'confirmed') updatePatch.accepted_at = new Date().toISOString();

  const { data, error: updateErr } = await supabaseAdmin
    .from('substitute_assignments')
    .update(updatePatch)
    .eq('id', id)
    .eq('school_id', schoolId)
    .select('id, status, accepted_at')
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Cancellation notification — direct Twilio, non-fatal
  if (status === 'cancelled') {
    try {
      const sub = assignment.substitute_staff as { name?: string; phone?: string } | null;
      const cls = assignment.class as { grade_level?: string; section?: string } | null;
      const className = `Grade ${cls?.grade_level ?? '?'}${cls?.section ? '-' + cls.section : ''}`;
      await sendCancellationWhatsApp(sub?.phone, sub?.name ?? 'teacher', className, assignment.date ?? 'today');
    } catch (notifErr) { console.error('[substitute/cancel] notification failed (non-fatal):', notifErr); }
  }

  return NextResponse.json({ success: true, assignment: data });
}
