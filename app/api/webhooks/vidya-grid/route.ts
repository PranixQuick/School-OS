// app/api/webhooks/vidya-grid/route.ts
// Bible Phase 4b — Inbound webhook receiver for VIDYA GRID events.
//
// POST /api/webhooks/vidya-grid
// This path must be added to middleware.ts PUBLIC_PATHS (no session required).
//
// VIDYA GRID sends webhooks with header: x-vg-signature
// Signature = hmac_sha256(raw_body, VIDYA_GRID_WEBHOOK_SECRET)
//
// Handles three event types (matching VIDYA GRID's webhook_endpoints registry):
//   session_complete   → log to vidya_grid_sync_events
//   stagnation_alert   → create student_risk_flags entry with source='vidya_grid'
//   passport_updated   → update students.vg_passport_snapshot + vg_passport_synced_at
//
// Idempotent: always returns 200 to VIDYA GRID even on skip/error, to prevent
// retries flooding the system. Errors are logged server-side.
//
// School isolation: verifies that the school_id in the webhook payload maps to
// an active School OS school with a matching vidya_grid_school_id.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// ── HMAC verification ────────────────────────────────────────────────────────

function verifySignature(rawBody: string, incomingSig: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== incomingSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ incomingSig.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── School resolution ────────────────────────────────────────────────────────

async function resolveSchool(vgSchoolId: string): Promise<{ schoolId: string } | null> {
  const { data } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('vidya_grid_school_id', vgSchoolId)
    .eq('is_active', true)
    .maybeSingle();
  return data ? { schoolId: data.id } : null;
}

// ── Student resolution ───────────────────────────────────────────────────────

async function resolveStudent(
  schoolId: string,
  vgUserId: string
): Promise<{ studentId: string } | null> {
  const { data } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('school_id', schoolId)
    .eq('vidya_grid_user_id', vgUserId)
    .maybeSingle();
  return data ? { studentId: data.id } : null;
}

// ── Event handlers ───────────────────────────────────────────────────────────

async function handleSessionComplete(
  schoolId: string,
  studentId: string | null,
  payload: Record<string, unknown>
) {
  await supabaseAdmin.from('vidya_grid_sync_events').insert({
    school_id: schoolId,
    student_id: studentId,
    event_type: 'session_completed',
    payload,
    sync_status: 'received',
    created_at: new Date().toISOString(),
  });
}

async function handleStagnationAlert(
  schoolId: string,
  studentId: string | null,
  payload: Record<string, unknown>
) {
  if (!studentId) {
    console.warn('[webhook/vidya-grid] stagnation_alert: student not linked, logging as sync event only');
    await supabaseAdmin.from('vidya_grid_sync_events').insert({
      school_id: schoolId,
      event_type: 'stagnation_alert',
      payload,
      sync_status: 'unlinked_student',
      created_at: new Date().toISOString(),
    });
    return;
  }

  // Write to student_risk_flags with source='vidya_grid'
  await supabaseAdmin.from('student_risk_flags').upsert({
    school_id: schoolId,
    student_id: studentId,
    risk_level: (payload.severity as string) === 'critical' ? 'critical'
              : (payload.severity as string) === 'high' ? 'high'
              : 'medium',
    risk_factors: [payload.description ?? 'Learning stagnation detected by VIDYA GRID'],
    ai_summary: (payload.recommendation as string) ?? 'VIDYA GRID flagged this student for learning stagnation. Review concept mastery data.',
    source: 'vidya_grid',
    flagged_at: new Date().toISOString(),
    resolved_at: null,
  }, { onConflict: 'school_id,student_id' });

  // Also log to sync events for audit trail
  await supabaseAdmin.from('vidya_grid_sync_events').insert({
    school_id: schoolId,
    student_id: studentId,
    event_type: 'stagnation_alert',
    payload,
    sync_status: 'processed',
    created_at: new Date().toISOString(),
  });
}

async function handlePassportUpdated(
  schoolId: string,
  studentId: string | null,
  payload: Record<string, unknown>
) {
  if (!studentId) {
    console.warn('[webhook/vidya-grid] passport_updated: student not linked, logging only');
    await supabaseAdmin.from('vidya_grid_sync_events').insert({
      school_id: schoolId,
      event_type: 'passport_updated',
      payload,
      sync_status: 'unlinked_student',
      created_at: new Date().toISOString(),
    });
    return;
  }

  // Store latest passport snapshot on the student row
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('students')
    .update({
      vg_passport_snapshot: payload.passport ?? payload,
      vg_passport_synced_at: now,
    })
    .eq('id', studentId)
    .eq('school_id', schoolId);

  await supabaseAdmin.from('vidya_grid_sync_events').insert({
    school_id: schoolId,
    student_id: studentId,
    event_type: 'passport_updated',
    payload,
    sync_status: 'processed',
    synced_at: now,
    created_at: now,
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.VIDYA_GRID_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook/vidya-grid] VIDYA_GRID_WEBHOOK_SECRET not configured');
    return NextResponse.json({ ok: true });
  }

  // Read raw body for HMAC verification
  const rawBody = await req.text();
  const incomingSig = req.headers.get('x-vg-signature') ?? '';

  if (!verifySignature(rawBody, incomingSig, secret)) {
    console.warn('[webhook/vidya-grid] signature mismatch — ignoring event');
    return NextResponse.json({ ok: true });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    console.error('[webhook/vidya-grid] failed to parse event body');
    return NextResponse.json({ ok: true });
  }

  const eventType = event.event_type as string | undefined;
  const vgSchoolId = event.school_id as string | undefined;
  const vgUserId = event.user_id as string | undefined;
  const data = (event.data ?? event.payload ?? {}) as Record<string, unknown>;

  if (!eventType || !vgSchoolId) {
    console.warn('[webhook/vidya-grid] missing event_type or school_id');
    return NextResponse.json({ ok: true });
  }

  // Resolve School OS school from VIDYA GRID school ID
  const school = await resolveSchool(vgSchoolId);
  if (!school) {
    console.warn('[webhook/vidya-grid] school not linked:', vgSchoolId);
    return NextResponse.json({ ok: true });
  }

  // Resolve student (may be null if not yet linked)
  const student = vgUserId
    ? await resolveStudent(school.schoolId, vgUserId)
    : null;

  try {
    switch (eventType) {
      case 'session_complete':
      case 'session_completed':
        await handleSessionComplete(school.schoolId, student?.studentId ?? null, data);
        break;

      case 'stagnation_alert':
      case 'risk_flag_raised':
        await handleStagnationAlert(school.schoolId, student?.studentId ?? null, data);
        break;

      case 'passport_updated':
        await handlePassportUpdated(school.schoolId, student?.studentId ?? null, data);
        break;

      default:
        console.log('[webhook/vidya-grid] unknown event_type:', eventType);
        // Log unknown events so we don't lose data
        await supabaseAdmin.from('vidya_grid_sync_events').insert({
          school_id: school.schoolId,
          student_id: student?.studentId ?? null,
          event_type: eventType,
          payload: data,
          sync_status: 'unknown_type',
          created_at: new Date().toISOString(),
        });
    }
  } catch (err) {
    console.error('[webhook/vidya-grid] handler error:', eventType, err);
    // Still return 200 — don't cause VIDYA GRID to retry on our internal errors
  }

  return NextResponse.json({ ok: true });
}
