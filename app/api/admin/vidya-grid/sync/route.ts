// app/api/admin/vidya-grid/sync/route.ts
// Admin-only outbound VidyaGrid enrollment sync.
//
// POST /api/admin/vidya-grid/sync
//
// Finds eligible UNLINKED students for the caller's school and enrolls them in
// VIDYA GRID via the server-to-server enroll API, writing
// students.vidya_grid_user_id from the response (keyed by erp_student_id = students.id).
//
// Additive only — does NOT touch student creation or importer routes.
// Idempotent — only processes students with vidya_grid_user_id IS NULL, and the
// write-back is guarded by `.is('vidya_grid_user_id', null)`.
// Throttled to MAX_PER_RUN to respect the VG /api/enroll rate limit (30/hr/IP);
// re-run (manually or via cron) until remaining_eligible reaches 0.
//
// Auth: requireAdminSession (owner | principal | admin_staff | accountant | …)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { enrollStudentInVidyaGrid, vidyaGridConfigured, type VgClassLevel } from '@/lib/vidya-grid';

export const runtime = 'nodejs';

// VG /api/enroll is rate-limited to 30 enrollments per hour per IP.
const MAX_PER_RUN = 30;

// Classes eligible for VidyaGrid sync. Originally '9'/'10' only; widened to
// include Anganwadi pre-school age bands ('0-3','3-6') per founder decision
// 2026-07-05. VG's enrollSchema must accept the same set or enroll calls 400.
const ELIGIBLE_CLASSES: VgClassLevel[] = ['9', '10', '0-3', '3-6'];

type RowResult =
  | { id: string; status: 'linked'; vg_user_id: string }
  | { id: string; status: 'skipped'; reason: string }
  | { id: string; status: 'failed'; reason: string };

export async function POST(req: NextRequest) {
  // Auth — same pattern as other /api/admin routes
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  // Integration must be configured
  const cfg = vidyaGridConfigured();
  if (!cfg.ok) {
    return NextResponse.json({ error: 'vidya_grid_not_configured', missing: cfg.missing }, { status: 503 });
  }

  // School must be mapped to a VidyaGrid school
  const { data: school, error: schoolErr } = await supabaseAdmin
    .from('schools')
    .select('id, vidya_grid_school_id')
    .eq('id', schoolId)
    .maybeSingle();
  if (schoolErr) return NextResponse.json({ error: schoolErr.message }, { status: 500 });
  if (!school?.vidya_grid_school_id) {
    return NextResponse.json({ error: 'school_not_mapped_to_vidya_grid' }, { status: 409 });
  }
  const vgSchoolId = school.vidya_grid_school_id as string;

  // Eligible unlinked students: class 9/10, active, not yet linked.
  const { data: students, error: studErr } = await supabaseAdmin
    .from('students')
    .select('id, name, class, parent_name, phone_parent')
    .eq('school_id', schoolId)
    .is('vidya_grid_user_id', null)
    .eq('is_active', true)
    .in('class', ELIGIBLE_CLASSES)
    .limit(MAX_PER_RUN);
  if (studErr) return NextResponse.json({ error: studErr.message }, { status: 500 });

  const candidates = students ?? [];
  const results: RowResult[] = [];
  let linked = 0, skipped = 0, failed = 0;

  for (const s of candidates) {
    const parentName = (s.parent_name ?? '').trim();
    const parentContact = (s.phone_parent ?? '').trim();
    const studentName = (s.name ?? '').trim();

    // Required by VG enrollSchema — skip (don't waste a rate-limited call) if absent.
    if (!studentName || !parentName || !parentContact) {
      skipped++;
      results.push({ id: s.id, status: 'skipped', reason: 'missing_student_name_or_parent_details' });
      continue;
    }

    const r = await enrollStudentInVidyaGrid({
      erp_student_id: s.id,
      school_id: vgSchoolId,
      student_name: studentName,
      class_level: s.class === '10' ? '10' : '9',
      parent_name: parentName,
      parent_contact: parentContact,
    });

    if (!r.ok || !r.student_id) {
      failed++;
      results.push({ id: s.id, status: 'failed', reason: r.error ?? 'enroll_failed' });
      continue;
    }

    // Write linkage — idempotent guard keeps a concurrent run from double-writing.
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('students')
      .update({ vidya_grid_user_id: r.student_id })
      .eq('id', s.id)
      .eq('school_id', schoolId)
      .is('vidya_grid_user_id', null)
      .select('id');

    if (updErr) {
      failed++;
      results.push({ id: s.id, status: 'failed', reason: `link_write_failed: ${updErr.message}` });
      continue;
    }
    if (!updated || updated.length === 0) {
      // Already linked by a concurrent run between SELECT and UPDATE.
      skipped++;
      results.push({ id: s.id, status: 'skipped', reason: 'already_linked' });
      continue;
    }

    linked++;
    results.push({ id: s.id, status: 'linked', vg_user_id: r.student_id });
  }

  // Remaining eligible-unlinked count, for progress feedback across runs.
  const { count: remaining } = await supabaseAdmin
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .is('vidya_grid_user_id', null)
    .eq('is_active', true)
    .in('class', ['9', '10']);

  return NextResponse.json({
    processed: candidates.length,
    linked,
    skipped,
    failed,
    max_per_run: MAX_PER_RUN,
    remaining_eligible_unlinked: remaining ?? null,
    results,
  });
}
