// app/api/teacher/__tests__/cross_tenant_block.test.ts
// Item #1 Track C Phase 3 — Cross-tenant RLS verification.
//
// Per master decision OPTION_B_SUPABASE_ADMIN_WITH_EXPLICIT_SCOPING condition #4:
// "Tests must verify cross-tenant blocking — test teacher (school A) cannot read
//  another school's data. RLS is test target, not app code."
//
// This test uses Supabase auth with the seeded test teacher credentials, mints
// a real Supabase access token, binds it to supabaseForUser, then attempts to
// read rows from a DIFFERENT school (DPS Nadergul, school_id
// 73048703-f8aa-4668-981d-2cdf619767b3). Cross-tenant queries MUST return zero
// rows (RLS-blocked), not errors.
//
// Note: This is the ONE place in Phase 3 where supabaseForUser IS reachable —
// because the test runner authenticates explicitly with email+password to
// obtain a real Supabase access token. The Phase 3 ROUTE handlers can't do
// this without storing tokens (Item #15 territory). The test path validates
// the RLS scaffolding is correctly installed for when Item #15 lands.
//
// Run: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node --test app/api/teacher/__tests__/cross_tenant_block.test.ts
// (or via your preferred test runner once configured.)

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TEST_EMAIL = 'test.teacher@schoolos.local';
const TEST_PASSWORD = process.env.TEST_TEACHER_PASSWORD; // Must be set in test env
const TEST_TEACHER_STAFF_ID = 'ebfae3cc-6c8a-4d55-b363-4f0ca5f3b428';
const TEST_TEACHER_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_SCHOOL_ID = '73048703-f8aa-4668-981d-2cdf619767b3'; // DPS Nadergul

test('test teacher can authenticate with Supabase', async (t) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_PASSWORD) {
    t.skip('Required env vars not set');
    return;
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  assert.equal(error, null, 'auth should succeed');
  assert.ok(data.session, 'session should exist');
  assert.ok(data.session.access_token, 'access_token should exist');
});

test('RLS: test teacher CAN read own school data via supabaseForUser', async (t) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_PASSWORD) {
    t.skip('Required env vars not set');
    return;
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth } = await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (!auth.session) throw new Error('auth failed');

  const bound = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } },
  });

  // Read own timetable
  const { data: tt, error } = await bound
    .from('timetable')
    .select('id, staff_id')
    .eq('staff_id', TEST_TEACHER_STAFF_ID);

  assert.equal(error, null, 'read should not error');
  assert.ok(Array.isArray(tt) && tt.length > 0, 'should see own timetable rows');
  tt.forEach((row: { staff_id: string }) => {
    assert.equal(row.staff_id, TEST_TEACHER_STAFF_ID, 'every row belongs to test teacher');
  });
});

test('RLS: test teacher CANNOT read other school timetable rows', async (t) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_PASSWORD) {
    t.skip('Required env vars not set');
    return;
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth } = await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (!auth.session) throw new Error('auth failed');

  const bound = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } },
  });

  // Attempt to read rows scoped to a DIFFERENT school. RLS should return zero rows,
  // NOT an error. This is the canonical pattern: queries succeed but return empty.
  const { data, error } = await bound
    .from('timetable')
    .select('id, school_id')
    .eq('school_id', OTHER_SCHOOL_ID);

  assert.equal(error, null, 'cross-tenant read should not error (RLS returns empty)');
  assert.equal(Array.isArray(data) ? data.length : -1, 0, 'should see zero rows from other school');
});

test('RLS: test teacher CANNOT insert leave request for another staff_id', async (t) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_PASSWORD) {
    t.skip('Required env vars not set');
    return;
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth } = await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (!auth.session) throw new Error('auth failed');

  const bound = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } },
  });

  const FAKE_OTHER_STAFF_ID = '00000000-0000-0000-0000-0000ffffffff';

  const { error } = await bound.from('teacher_leave_requests').insert({
    school_id: TEST_TEACHER_SCHOOL_ID,
    staff_id: FAKE_OTHER_STAFF_ID,
    leave_type: 'casual',
    from_date: '2099-01-01',
    to_date: '2099-01-02',
    reason: 'IDOR attempt',
    status: 'pending',
  });

  assert.notEqual(error, null, 'insert MUST fail when staff_id != current_teacher_staff_id()');
});
