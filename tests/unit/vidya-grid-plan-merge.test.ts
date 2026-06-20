import { describe, it, expect } from 'vitest';
import { mergeVgPlanIntoFlags } from '../../lib/vidya-grid-entitlement';

describe('mergeVgPlanIntoFlags', () => {
  it('sets VG plan keys without clearing other feature_flags', () => {
    const current = {
      fee_module_enabled: true,
      razorpay_key_id: 'rzp_xxx',
      modules_enabled: { vidya_grid_integration: true, library: true },
    };
    const merged = mergeVgPlanIntoFlags(current, {
      vidya_grid_plan: 'paid',
      vidya_grid_paid_until: '2026-12-31T00:00:00Z',
      vidya_grid_seat_cap: 300,
    });
    expect(merged.fee_module_enabled).toBe(true);
    expect(merged.razorpay_key_id).toBe('rzp_xxx');
    expect(merged.modules_enabled).toEqual({ vidya_grid_integration: true, library: true });
    expect(merged.vidya_grid_plan).toBe('paid');
    expect(merged.vidya_grid_paid_until).toBe('2026-12-31T00:00:00Z');
    expect(merged.vidya_grid_seat_cap).toBe(300);
  });

  it('leaves untouched keys unchanged when patch omits them', () => {
    const current = { vidya_grid_plan: 'paid', vidya_grid_paid_until: '2026-12-31T00:00:00Z', other: 1 };
    const merged = mergeVgPlanIntoFlags(current, { vidya_grid_seat_cap: 50 });
    expect(merged.vidya_grid_plan).toBe('paid');
    expect(merged.vidya_grid_paid_until).toBe('2026-12-31T00:00:00Z');
    expect(merged.vidya_grid_seat_cap).toBe(50);
    expect(merged.other).toBe(1);
  });

  it('can clear paid_until / seat_cap with explicit null', () => {
    const current = { vidya_grid_plan: 'paid', vidya_grid_paid_until: '2026-12-31T00:00:00Z', vidya_grid_seat_cap: 10 };
    const merged = mergeVgPlanIntoFlags(current, { vidya_grid_paid_until: null, vidya_grid_seat_cap: null });
    expect(merged.vidya_grid_paid_until).toBeNull();
    expect(merged.vidya_grid_seat_cap).toBeNull();
    expect(merged.vidya_grid_plan).toBe('paid');
  });

  it('handles null/empty current without throwing', () => {
    expect(() => mergeVgPlanIntoFlags(null, { vidya_grid_plan: 'free' })).not.toThrow();
    expect(mergeVgPlanIntoFlags(undefined, { vidya_grid_plan: 'free' }).vidya_grid_plan).toBe('free');
  });
});
