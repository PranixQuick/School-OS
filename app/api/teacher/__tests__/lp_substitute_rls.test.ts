// app/api/teacher/__tests__/lp_substitute_rls.test.ts
// Item #1 Track C Phase 4 — RLS tests for lesson_plans and substitute_assignments.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = 'test.teacher@schoolos.local';
const TEST_PASSWORD = process.env.TEST_TEACHER_PASSWORD;
const TEST_TEACHER_STAFF_ID = 'ebfae3cc-6c8a-4d55-b363-4f0ca5f3b428';
const TEST_TEACHER_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const SEEDED_CLASS_ID = '00000000-0000-0000-0000-000000000104';
const SEEDED_SUBJECT_ID = '00000000-0000-0000-0000-000000000103';

async function boundClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_PASSWORD) return null;
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await c.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (!data.session) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + data.session.access_token } },
  });
}

test('RLS: teacher can insert their own lesson_plan', async (t) => {
  const bound = await boundClient();
  if (!bound) { t.skip('Required env vars not set'); return; }

  const plannedDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await bound.from('lesson_plans').insert({
    school_id: TEST_TEACHER_SCHOOL_ID,
    staff_id: TEST_TEACHER_STAFF_ID,
    class_id: SEEDED_CLASS_ID,
    subject_id: SEEDED_SUBJECT_ID,
    planned_date: plannedDate,
    completion_status: 'planned',
  }).select('id').single();

  assert.equal(error, null, 'own insert should succeed');
  assert.ok(data?.id, 'row created');

  if (data?.id) {
    await bound.from('lesson_plans').delete().eq('id', data.id);
  }
});

test('RLS: teacher CANNOT insert lesson_plan with foreign staff_id', async (t) => {
  const bound = await boundClient();
  if (!bound) { t.skip('Required env vars not set'); return; }

  const FAKE_STAFF = '00000000-0000-0000-0000-0000ffffffff';
  const plannedDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { error } = await bound.from('lesson_plans').insert({
    school_id: TEST_TEACHER_SCHOOL_ID,
    staff_id: FAKE_STAFF,
    class_id: SEEDED_CLASS_ID,
    subject_id: SEEDED_SUBJECT_ID,
    planned_date: plannedDate,
    completion_status: 'planned',
  });

  assert.notEqual(error, null, 'foreign staff_id insert MUST be blocked');
});

test('RLS: teacher CANNOT read other teacher substitute assignments', async (t) => {
  const bound = await boundClient();
  if (!bound) { t.skip('Required env vars not set'); return; }

  const FAKE_STAFF = '00000000-0000-0000-0000-0000ffffffff';
  // Query assignments where the test teacher is neither original nor substitute
  const { data, error } = await bound.from('substitute_assignments')
    .select('id')
    .eq('original_staff_id', FAKE_STAFF)
    .eq('substitute_staff_id', FAKE_STAFF);

  assert.equal(error, null, 'cross-teacher read should not error');
  assert.equal(Array.isArray(data) ? data.length : -1, 0, 'should see zero rows');
});
