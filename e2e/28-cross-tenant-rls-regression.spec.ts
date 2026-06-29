import { test, expect } from '@playwright/test';

// P5-01 regression guard for the SEC-W0-12 fix (migration fix_cross_tenant_rls_sec_w0_12).
// The previously always-true RLS policies are now school_users-scoped. Anonymous PostgREST reads
// (anon key, no user session) of the affected tables must now return an EMPTY array — never rows
// from other tenants. This calls the public REST endpoint directly with the anon key.
//
// Requires env: SUPABASE_URL, SUPABASE_ANON_KEY (CI secrets). Skips cleanly if unset.
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const ANON = process.env.SUPABASE_ANON_KEY || '';
const TABLES = [
  'exam_results', 'hall_tickets', 'faculty_members', 'test_scores', 'tests',
  'accreditation_records', 'examination_schedule', 'teacher_vacancies',
];

test.describe('Cross-tenant RLS regression — SEC-W0-12 (P5-01)', () => {
  test.skip(!SUPABASE_URL || !ANON, 'SUPABASE_URL / SUPABASE_ANON_KEY not set');

  for (const tbl of TABLES) {
    test(`anon cannot read ${tbl} across tenants`, async ({ request }) => {
      const res = await request.get(`${SUPABASE_URL}/rest/v1/${tbl}?select=id&limit=1`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      // PostgREST returns 200 + [] when RLS yields no rows (correct), or 401/403.
      expect([200, 401, 403]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(Array.isArray(body) ? body.length : 0, `${tbl} leaked rows to anon`).toBe(0);
      }
    });
  }
});
