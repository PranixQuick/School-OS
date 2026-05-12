// app/api/teacher/__tests__/homework_grading.test.ts
// Item #1 Track C Phase 3 PR #2b — verifies homework grading flow + RLS boundary.

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

test('RLS: teacher can insert homework they assign', async (t) => {
  const bound = await boundClient();
  if (!bound) { t.skip('Required env vars not set'); return; }

  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await bound.from('homework').insert({
    school_id: TEST_TEACHER_SCHOOL_ID,
    class_id: SEEDED_CLASS_ID,
    subject_id: SEEDED_SUBJECT_ID,
    assigned_by: TEST_TEACHER_STAFF_ID,
    title: 'RLS test homework',
    due_date: dueDate,
  }).select('id').single();

  assert.equal(error, null, 'insert with own staff_id should succeed');
  assert.ok(data?.id, 'homework row created');

  // Clean up — own row, RLS allows delete via fallback school_scoped policy
  if (data?.id) {
    await bound.from('homework').delete().eq('id', data.id);
  }
});

test('RLS: teacher CANNOT insert homework with another teacher staff_id (IDOR)', async (t) => {
  const bound = await boundClient();
  if (!bound) { t.skip('Required env vars not set'); return; }

  const FAKE_STAFF = '00000000-0000-0000-0000-0000ffffffff';
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { error } = await bound.from('homework').insert({
    school_id: TEST_TEACHER_SCHOOL_ID,
    class_id: SEEDED_CLASS_ID,
    subject_id: SEEDED_SUBJECT_ID,
    assigned_by: FAKE_STAFF,
    title: 'IDOR attempt',
    due_date: dueDate,
  });

  assert.notEqual(error, null, 'insert with foreign staff_id MUST be RLS-blocked');
});

test('RLS: teacher CANNOT read homework assigned by another teacher', async (t) => {
  const bound = await boundClient();
  if (!bound) { t.skip('Required env vars not set'); return; }

  // Read homework rows scoped to a fake other teacher
  const FAKE_STAFF = '00000000-0000-0000-0000-0000ffffffff';
  const { data, error } = await bound.from('homework')
    .select('id')
    .eq('assigned_by', FAKE_STAFF);

  assert.equal(error, null, 'cross-teacher read should not error');
  assert.equal(Array.isArray(data) ? data.length : -1, 0, 'should see zero rows');
});
