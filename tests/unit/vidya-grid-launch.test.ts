import { describe, it, expect } from 'vitest';
import { buildVgLaunchClaims, VG_LAUNCH_CLAIM, VG_LAUNCH_ISS, VG_LAUNCH_AUD } from '../../lib/vidya-grid-launch';

describe('buildVgLaunchClaims', () => {
  const base = {
    erpStudentId: 'stu-1', vgUserId: 'vg-1', schoolId: 'sch-1',
    plan: 'paid' as const, paidActive: true, consentOk: true, nowSec: 1_000_000,
  };

  it('sets registered claims and a 120s expiry by default', () => {
    const c = buildVgLaunchClaims(base);
    expect(c.iss).toBe(VG_LAUNCH_ISS);
    expect(c.aud).toBe(VG_LAUNCH_AUD);
    expect(c.sub).toBe('stu-1');
    expect(c.iat).toBe(1_000_000);
    expect(c.exp).toBe(1_000_120);
  });

  it('carries the namespaced custom claim', () => {
    const c = buildVgLaunchClaims(base) as Record<string, unknown>;
    expect(c[VG_LAUNCH_CLAIM]).toEqual({
      erp_student_id: 'stu-1', vg_user_id: 'vg-1', school_id: 'sch-1',
      plan: 'paid', paid_active: true, consent_ok: true,
    });
  });

  it('honors a custom ttl', () => {
    const c = buildVgLaunchClaims({ ...base, ttlSec: 60 });
    expect(c.exp).toBe(1_000_060);
  });
});
