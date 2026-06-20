// app/api/vidya-grid/entitlement/route.ts
// VG-6 — authoritative entitlement check for Vidya Grid (server-to-server).
//
// VG calls this before unlocking paid features (the launch token is a hint; this
// is the source of truth). HMAC-authed EXACTLY like the inbound webhook:
//   header x-vg-signature = hmac_sha256(rawBody, VIDYA_GRID_WEBHOOK_SECRET), hex,
//   constant-time compared.
//
// Body: { vg_user_id }. Returns { plan, paid_active, paid_until, seat_cap,
// consent_ok }. Unknown vg_user_id -> { plan:'none', ... } (never throws, never
// leaks). Reuses the pure resolveVgEntitlement so the tiering logic stays single-
// sourced + unit-tested. No secret ever reaches a client.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getInstitutionFlags } from '@/lib/institution-flags';
import { resolveVgEntitlement, type SchoolVgFlags, type StudentVgSub } from '@/lib/vidya-grid-entitlement';
import { hasAdaptiveLearningConsentForStudent } from '@/lib/vidya-grid-consent';

export const runtime = 'nodejs';

const NONE = { plan: 'none', paid_active: false, paid_until: null, seat_cap: null, consent_ok: false };

function verifySignature(rawBody: string, incomingSig: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected.length !== incomingSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ incomingSig.charCodeAt(i);
  return mismatch === 0;
}

function notExpired(paidUntil: string | null, nowMs: number): boolean {
  if (paidUntil == null) return true;
  const t = Date.parse(paidUntil);
  if (Number.isNaN(t)) return false;
  return nowMs <= t;
}

export async function POST(req: NextRequest) {
  const secret = process.env.VIDYA_GRID_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[vg-entitlement] VIDYA_GRID_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const incomingSig = req.headers.get('x-vg-signature') ?? '';
  if (!verifySignature(rawBody, incomingSig, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let body: { vg_user_id?: unknown };
  try { body = JSON.parse(rawBody || '{}'); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const vgUserId = typeof body.vg_user_id === 'string' ? body.vg_user_id.trim() : '';
  if (!vgUserId) return NextResponse.json({ error: 'vg_user_id required' }, { status: 400 });

  // Resolve the EdProSys student from the VG user id.
  const { data: student } = await supabaseAdmin
    .from('students').select('id, school_id').eq('vidya_grid_user_id', vgUserId).maybeSingle();
  if (!student) return NextResponse.json(NONE); // unknown VG user -> none (authoritative deny)

  const flags = (await getInstitutionFlags(student.school_id)) as SchoolVgFlags;
  const { data: subsData } = await supabaseAdmin
    .from('student_vidya_grid_subscriptions')
    .select('plan, paid_until')
    .eq('student_id', student.id)
    .eq('school_id', student.school_id);
  const subs = (subsData ?? []) as StudentVgSub[];

  const ent = resolveVgEntitlement(flags, subs, new Date());

  // Effective paid_until for the winning source.
  let paidUntil: string | null = null;
  if (ent.paidActive) {
    if (ent.source === 'school') {
      paidUntil = (flags.vidya_grid_paid_until as string | null) ?? null;
    } else if (ent.source === 'parent') {
      const nowMs = Date.now();
      const active = subs.filter((s) => s && s.plan === 'paid' && notExpired(s.paid_until, nowMs));
      if (active.some((s) => s.paid_until == null)) {
        paidUntil = null; // an unlimited sub is active
      } else {
        const ts = active.map((s) => Date.parse(s.paid_until as string)).filter((n) => !Number.isNaN(n));
        paidUntil = ts.length ? new Date(Math.max(...ts)).toISOString() : null;
      }
    }
  }

  const consentOk = await hasAdaptiveLearningConsentForStudent(student.id, student.school_id);

  return NextResponse.json({
    plan: ent.plan,
    paid_active: ent.paidActive,
    paid_until: paidUntil,
    seat_cap: ent.seatCap,
    consent_ok: consentOk,
  });
}
