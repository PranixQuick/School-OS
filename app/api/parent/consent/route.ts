// app/api/parent/consent/route.ts
// Item #3 DPDP Compliance — PR #2
// POST: record parent consent (append-only, full audit trail).
// GET:  current consent status per type (most recent row per type).
//
// Auth: phone+PIN per request (same pattern as all other parent routes — no session cookie).
// TODO(item-15): migrate to supabaseForUser when parent auth moves to session model.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const VALID_CONSENT_TYPES = new Set([
  'data_processing','whatsapp_communication','data_retention','third_party_sharing',
]);
const VALID_STATUSES = new Set(['granted','withdrawn']);

async function resolveParent(phone: string, pin: string) {
  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id')
    .eq('phone', phone)
    .eq('access_pin', pin);
  if (error) return { error: 'Failed to verify credentials', status: 500 as const };
  if (!parents || parents.length === 0) return { error: 'Invalid phone or PIN', status: 401 as const };
  if (parents.length > 1) return { error: 'Multiple accounts match this phone. Contact your school admin.', status: 409 as const };
  return { parent: parents[0] };
}

// ─── POST: record consent entries ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { phone, pin, consents } = body as { phone?: string; pin?: string; consents?: { consent_type: string; status: string }[] };
  if (!phone || !pin) return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
  if (!Array.isArray(consents) || consents.length === 0) return NextResponse.json({ error: 'consents array required' }, { status: 400 });

  const resolved = await resolveParent(phone, pin);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { parent } = resolved;

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;
  const now = new Date().toISOString();
  let recorded = 0;
  const errors: string[] = [];

  for (const entry of consents) {
    if (!VALID_CONSENT_TYPES.has(entry.consent_type)) {
      errors.push(`Invalid consent_type: ${entry.consent_type}`);
      continue;
    }
    if (!VALID_STATUSES.has(entry.status)) {
      errors.push(`Invalid status: ${entry.status} for ${entry.consent_type}`);
      continue;
    }
    // Append-only — no UPDATE to existing rows. New row per change = full audit trail.
    const { error: insErr } = await supabaseAdmin.from('parent_consent_log').insert({
      school_id: parent.school_id,
      parent_id: parent.id,
      consent_type: entry.consent_type,
      status: entry.status,
      granted_at:   entry.status === 'granted'   ? now : null,
      withdrawn_at: entry.status === 'withdrawn' ? now : null,
      ip_address: ip,
      source: 'parent_app',
    });
    if (insErr) errors.push(`Failed to record ${entry.consent_type}: ${insErr.message}`);
    else recorded++;
  }

  return NextResponse.json({ recorded, errors });
}

// ─── GET: current consent status (most recent per type) ───────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const phone = searchParams.get('phone');
  const pin   = searchParams.get('pin');
  if (!phone || !pin) return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });

  const resolved = await resolveParent(phone, pin);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { parent } = resolved;

  // DISTINCT ON (consent_type) — most recent row per type
  const { data, error } = await supabaseAdmin
    .from('parent_consent_log')
    .select('consent_type, status, granted_at, withdrawn_at, created_at')
    .eq('parent_id', parent.id)
    .eq('school_id', parent.school_id)
    .order('consent_type', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deduplicate: keep most recent per consent_type (Supabase doesn't support DISTINCT ON natively)
  const seen = new Set<string>();
  const current = (data ?? []).filter(r => {
    if (seen.has(r.consent_type)) return false;
    seen.add(r.consent_type);
    return true;
  });

  return NextResponse.json({ consents: current, parent_id: parent.id });
}
