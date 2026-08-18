import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// SEC-CRITICAL-2 — live exploit probe.
//
// Every request below is exactly the attack an unauthenticated outsider would
// run. It sends no cookie, only the forged identity headers that the old
// lib/getSchoolId.ts trusted.
//
// SAFETY: this spec deliberately probes GET/read-only endpoints ONLY. It must
// never be extended to POST/PATCH/DELETE routes, because the whole point is
// that it runs against a live environment — if the vulnerability were present,
// a mutating probe would write attacker-controlled data into a real tenant.
//
// These assertions are falsifiable in the way that matters: they fail loudly
// if the endpoint answers with data instead of rejecting the caller.
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_SCHOOL = '00000000-0000-0000-0000-000000000001';

const FORGED_HEADERS = {
  'x-school-id': DEMO_SCHOOL,
  'x-user-role': 'owner',
  'x-user-email': 'attacker@example.com',
  'x-super-admin': 'true',
};

// Read-only routes that previously derived their tenant from x-school-id.
const READ_ONLY_ROUTES = [
  '/api/whatsapp/conversations?limit=1',
  '/api/whatsapp/knowledge',
  '/api/teacher-eval/history',
  '/api/cron/run',
  '/api/principal/classroom-proofs/list',
  '/api/principal/lesson-plans/coverage',
  '/api/principal/substitute/list-needed',
  '/api/reports/govt/dise-enrolment',
  '/api/notifications/health',
];

// Field names that would indicate real tenant data leaked back to the caller.
const LEAK_INDICATORS = [
  'phone_number',
  'admission_number',
  'parent_phone',
  'conversations',
  'runs',
  'enrolment',
];

test.describe('SEC-CRITICAL-2: forged identity headers must not authenticate', () => {
  for (const route of READ_ONLY_ROUTES) {
    test(`GET ${route} rejects forged x-school-id/x-user-role`, async ({ request }) => {
      const res = await request.get(route, { headers: FORGED_HEADERS });

      // The endpoint must refuse. 401 is correct; 403 is acceptable; 404/405 is
      // acceptable if the route was removed. Anything in the 2xx range means the
      // forged headers were honoured.
      expect(
        res.status(),
        `${route} answered ${res.status()} to an unauthenticated forged-header request`
      ).toBeGreaterThanOrEqual(400);

      const body = await res.text();

      // Belt and braces: even on a 5xx, the response must not contain tenant data.
      for (const indicator of LEAK_INDICATORS) {
        expect(
          body.includes(`"${indicator}"`),
          `${route} leaked field "${indicator}" to an unauthenticated caller`
        ).toBe(false);
      }

      // The victim school id must never be echoed back with data attached.
      expect(
        body.includes(DEMO_SCHOOL) && res.status() < 400,
        `${route} echoed the forged school id in a successful response`
      ).toBe(false);
    });
  }

  test('a request with no headers at all is also rejected', async ({ request }) => {
    const res = await request.get('/api/whatsapp/conversations?limit=1');
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('control: the health endpoint is reachable, proving the probe can reach the app', async ({
    request,
  }) => {
    // Guards against a false pass where every request fails for an unrelated
    // reason (DNS, deploy down) and the suite reports green.
    const res = await request.get('/api/health');
    expect(res.status()).toBeLessThan(400);
  });
});
