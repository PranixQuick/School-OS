import { describe, it, expect } from 'vitest';
import { latestConsentGranted } from '../../lib/vidya-grid-consent';

describe('latestConsentGranted', () => {
  it('empty / null / undefined => false (fail-safe deny)', () => {
    expect(latestConsentGranted([])).toBe(false);
    expect(latestConsentGranted(null)).toBe(false);
    expect(latestConsentGranted(undefined)).toBe(false);
  });

  it('single granted => true', () => {
    expect(latestConsentGranted([{ status: 'granted', created_at: '2026-06-20T00:00:00Z' }])).toBe(true);
  });

  it('single withdrawn => false', () => {
    expect(latestConsentGranted([{ status: 'withdrawn', created_at: '2026-06-20T00:00:00Z' }])).toBe(false);
  });

  it('most recent wins: granted then withdrawn => false', () => {
    expect(latestConsentGranted([
      { status: 'granted', created_at: '2026-06-01T00:00:00Z' },
      { status: 'withdrawn', created_at: '2026-06-20T00:00:00Z' },
    ])).toBe(false);
  });

  it('most recent wins: withdrawn then granted => true (order-independent)', () => {
    expect(latestConsentGranted([
      { status: 'withdrawn', created_at: '2026-06-01T00:00:00Z' },
      { status: 'granted', created_at: '2026-06-20T00:00:00Z' },
    ])).toBe(true);
  });

  it('pending latest => false', () => {
    expect(latestConsentGranted([
      { status: 'granted', created_at: '2026-06-01T00:00:00Z' },
      { status: 'pending', created_at: '2026-06-20T00:00:00Z' },
    ])).toBe(false);
  });
});
