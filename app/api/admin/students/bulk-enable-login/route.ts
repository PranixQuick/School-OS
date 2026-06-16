// app/api/admin/students/bulk-enable-login/route.ts
// Batch 4D — Bulk enable student login with auto-generated PINs.
// PIN patterns: last4_admission | dob_ddmm | custom.
// Plain-text storage matching parent auth pattern (auto-hashed on first login).
//
// P0 SAFEGUARD (fix/p0-student-bulk-enable-null-guard):
//  - NULL-only guard: only provisions students with NO existing credential
//    (access_pin IS NULL AND access_pin_hashed IS NULL). Already-provisioned
//    students are never selected, so existing PINs can never be overwritten.
//  - dry_run: when true, computes counts and writes nothing.
//  - Write-time guard re-asserted on each UPDATE (race-safe).
//  - Returns { enabled, skipped_existing, skipped_no_admission, total_matched, dry_run }.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { studentClass, section, default_pin_pattern, custom_pin, dry_run } = body as {
    studentClass?: string; section?: string;
    default_pin_pattern?: 'last4_admission' | 'dob_ddmm' | 'custom';
    custom_pin?: string;
    dry_run?: boolean;
  };
  if (!default_pin_pattern) return NextResponse.json({ error: 'default_pin_pattern required' }, { status: 400 });
  if (default_pin_pattern === 'custom' && !custom_pin) return NextResponse.json({ error: 'custom_pin required for custom pattern' }, { status: 400 });
  if (custom_pin && !/^\d{4,6}$/.test(custom_pin)) return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });

  const isDryRun = dry_run === true;

  // total_matched: every active student in scope (provisioned or not).
  let countQ = supabaseAdmin
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (studentClass) countQ = countQ.eq('class', studentClass);
  if (section) countQ = countQ.eq('section', section);
  const { count: totalMatched, error: cErr } = await countQ;
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  // NULL-only guard: only fetch students with NO existing credential.
  let listQ = supabaseAdmin
    .from('students')
    .select('id, admission_number, date_of_birth')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .is('access_pin', null)
    .is('access_pin_hashed', null);
  if (studentClass) listQ = listQ.eq('class', studentClass);
  if (section) listQ = listQ.eq('section', section);
  const { data: students, error } = await listQ;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unprovisioned = students ?? [];
  const skipped_existing = Math.max(0, (totalMatched ?? 0) - unprovisioned.length);

  const now = new Date().toISOString();
  let enabled = 0;
  let skipped_no_admission = 0;
  const BATCH = 50;

  for (let i = 0; i < unprovisioned.length; i += BATCH) {
    const chunk = unprovisioned.slice(i, i + BATCH);
    for (const s of chunk) {
      let pin: string;
      if (default_pin_pattern === 'last4_admission') {
        const adm = (s.admission_number ?? '').trim();
        if (!adm) { skipped_no_admission++; continue; } // cannot log in without an admission number
        pin = adm.slice(-4).padStart(4, '0');
      } else if (default_pin_pattern === 'dob_ddmm') {
        if (!s.date_of_birth) { skipped_no_admission++; continue; } // no DOB to derive a PIN
        const d = new Date(s.date_of_birth);
        pin = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0');
      } else {
        pin = custom_pin ?? '0000';
      }

      if (isDryRun) { enabled++; continue; }

      const { error: uErr } = await supabaseAdmin
        .from('students')
        .update({ access_pin: pin, pin_set_at: now, student_login_enabled: true })
        .eq('id', s.id)
        .eq('school_id', schoolId)
        .is('access_pin', null)
        .is('access_pin_hashed', null); // re-assert guard at write time (race-safe)
      if (!uErr) enabled++;
    }
  }

  return NextResponse.json({
    enabled,
    skipped_existing,
    skipped_no_admission,
    total_matched: totalMatched ?? 0,
    dry_run: isDryRun,
  });
}
