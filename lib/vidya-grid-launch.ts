// lib/vidya-grid-launch.ts
// VG-5 — pure builder for the EdProSys -> Vidya Grid SSO launch token claims.
//
// Shape is LTI-1.3-compatible (standard JWT registered claims + a namespaced
// custom claim) so this can become real LTI later without a rebuild. The token
// is short-lived (default 120s) and HMAC-signed (HS256) by the route with the
// VIDYA_GRID_LAUNCH_SECRET. This builder is pure (no I/O) so it's unit-testable.

import type { VgPlan } from '@/lib/vidya-grid-entitlement';

export const VG_LAUNCH_ISS = 'https://edprosys.com';
export const VG_LAUNCH_AUD = 'vidya-grid';
export const VG_LAUNCH_CLAIM = 'https://edprosys.com/vg';
export const VG_LAUNCH_TTL_SEC = 120;

export interface VgLaunchInput {
  erpStudentId: string;
  vgUserId: string;
  schoolId: string;        // VG school id (falls back to EdProSys school id)
  plan: VgPlan;
  paidActive: boolean;
  consentOk: boolean;
  nowSec?: number;         // unix seconds (injected for tests)
  ttlSec?: number;         // default 120
}

export function buildVgLaunchClaims(i: VgLaunchInput): Record<string, unknown> {
  const now = i.nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = i.ttlSec ?? VG_LAUNCH_TTL_SEC;
  return {
    iss: VG_LAUNCH_ISS,
    aud: VG_LAUNCH_AUD,
    sub: i.erpStudentId,
    iat: now,
    exp: now + ttl,
    [VG_LAUNCH_CLAIM]: {
      erp_student_id: i.erpStudentId,
      vg_user_id: i.vgUserId,
      school_id: i.schoolId,
      plan: i.plan,
      paid_active: i.paidActive,
      consent_ok: i.consentOk,
    },
  };
}
