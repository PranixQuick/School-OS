import { describe, it, expect } from 'vitest';
import { computePaidUntil } from '../../lib/vidya-grid-entitlement';

describe('computePaidUntil', () => {
  const from = new Date('2026-06-20T00:00:00Z');

  it('monthly => +1 month', () => {
    expect(computePaidUntil('monthly', from)).toBe('2026-07-20T00:00:00.000Z');
  });

  it('yearly => +1 year', () => {
    expect(computePaidUntil('yearly', from)).toBe('2027-06-20T00:00:00.000Z');
  });

  it('returns a value strictly in the future of `from`', () => {
    const m = Date.parse(computePaidUntil('monthly', from));
    const y = Date.parse(computePaidUntil('yearly', from));
    expect(m).toBeGreaterThan(from.getTime());
    expect(y).toBeGreaterThan(m);
  });
});
