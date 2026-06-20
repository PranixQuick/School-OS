import { describe, it, expect } from 'vitest';
import { resolveVgEntitlement } from '../../lib/vidya-grid-entitlement';

const NOW = new Date('2026-06-20T00:00:00Z');
const FUTURE = '2026-12-31T00:00:00Z';
const PAST = '2026-01-01T00:00:00Z';

describe('resolveVgEntitlement', () => {
  it('no VG anywhere => none', () => {
    const e = resolveVgEntitlement({}, [], NOW);
    expect(e.plan).toBe('none');
    expect(e.paidActive).toBe(false);
    expect(e.source).toBe('none');
  });

  it('school free => free', () => {
    const e = resolveVgEntitlement({ vidya_grid_plan: 'free' }, [], NOW);
    expect(e.plan).toBe('free');
    expect(e.source).toBe('school');
  });

  it('school paid, not expired => paid (school)', () => {
    const e = resolveVgEntitlement({ vidya_grid_plan: 'paid', vidya_grid_paid_until: FUTURE }, [], NOW);
    expect(e).toMatchObject({ plan: 'paid', paidActive: true, source: 'school' });
  });

  it('school paid but expired => free', () => {
    const e = resolveVgEntitlement({ vidya_grid_plan: 'paid', vidya_grid_paid_until: PAST }, [], NOW);
    expect(e.plan).toBe('free');
    expect(e.paidActive).toBe(false);
  });

  it('school paid, no expiry (null) => paid', () => {
    const e = resolveVgEntitlement({ vidya_grid_plan: 'paid', vidya_grid_paid_until: null }, [], NOW);
    expect(e.plan).toBe('paid');
  });

  it('free school + active parent top-up => paid (parent)', () => {
    const e = resolveVgEntitlement({ vidya_grid_plan: 'free' }, [{ plan: 'paid', paid_until: FUTURE }], NOW);
    expect(e).toMatchObject({ plan: 'paid', paidActive: true, source: 'parent' });
  });

  it('expired parent top-up + free school => free', () => {
    const e = resolveVgEntitlement({ vidya_grid_plan: 'free' }, [{ plan: 'paid', paid_until: PAST }], NOW);
    expect(e.plan).toBe('free');
  });

  it('higher-of: school paid takes source even when student also paid', () => {
    const e = resolveVgEntitlement(
      { vidya_grid_plan: 'paid', vidya_grid_paid_until: FUTURE },
      [{ plan: 'paid', paid_until: FUTURE }],
      NOW,
    );
    expect(e).toMatchObject({ plan: 'paid', source: 'school' });
  });

  it('seatCap passthrough', () => {
    const e = resolveVgEntitlement({ vidya_grid_plan: 'free', vidya_grid_seat_cap: 200 }, [], NOW);
    expect(e.seatCap).toBe(200);
  });

  it('unparseable paid_until => treated as expired (fail-safe)', () => {
    const e = resolveVgEntitlement({ vidya_grid_plan: 'paid', vidya_grid_paid_until: 'not-a-date' }, [], NOW);
    expect(e.plan).toBe('free');
  });

  it('null/undefined inputs never throw', () => {
    expect(() => resolveVgEntitlement(null, null, NOW)).not.toThrow();
    expect(resolveVgEntitlement(undefined, undefined, NOW).plan).toBe('none');
  });
});
