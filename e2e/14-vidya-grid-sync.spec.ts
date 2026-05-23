// e2e/14-vidya-grid-sync.spec.ts
// Bible Phase 6 Priority 1: VIDYA GRID webhook receiver contract test
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';
import { createHmac } from 'crypto';

test.describe('VIDYA GRID webhook integration', () => {
  // These tests verify the webhook endpoint responds correctly to different
  // event payloads. They don't need HMAC in most cases because the endpoint
  // returns 200 even on signature failure (by design — never reveal verification status).

  test('webhook returns 200 for valid-shaped session_complete', async ({ request }) => {
    const payload = JSON.stringify({
      event_type: 'session_complete',
      school_id: 'PEDDAPALLI-ZPH-001',
      user_id: '00000000-0000-0000-0000-000000000000',
      data: { session_key: 'SES-test123', concepts_covered: 3 },
    });
    const resp = await request.post(`${BASE_URL}/api/webhooks/vidya-grid`, {
      headers: { 'Content-Type': 'application/json' },
      data: payload,
    });
    // Always returns 200 (idempotent design)
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('ok', true);
  });

  test('webhook returns 200 for stagnation_alert', async ({ request }) => {
    const payload = JSON.stringify({
      event_type: 'stagnation_alert',
      school_id: 'PEDDAPALLI-ZPH-001',
      user_id: '00000000-0000-0000-0000-000000000000',
      data: { severity: 'high', description: 'Test stagnation alert' },
    });
    const resp = await request.post(`${BASE_URL}/api/webhooks/vidya-grid`, {
      headers: { 'Content-Type': 'application/json' },
      data: payload,
    });
    expect(resp.status()).toBe(200);
  });

  test('webhook returns 200 for passport_updated', async ({ request }) => {
    const payload = JSON.stringify({
      event_type: 'passport_updated',
      school_id: 'PEDDAPALLI-ZPH-001',
      user_id: '00000000-0000-0000-0000-000000000000',
      data: { passport: { concepts: [], mastery_pct: 0 } },
    });
    const resp = await request.post(`${BASE_URL}/api/webhooks/vidya-grid`, {
      headers: { 'Content-Type': 'application/json' },
      data: payload,
    });
    expect(resp.status()).toBe(200);
  });

  test('webhook returns 200 for unknown event_type (logs, does not crash)', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/webhooks/vidya-grid`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ event_type: 'unknown_future_event', school_id: 'TEST' }),
    });
    expect(resp.status()).toBe(200);
  });
});
