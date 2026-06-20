// app/api/vidya-grid/launch/route.ts
// VG-5 — SSO launch: EdProSys -> Vidya Grid.
//
// GET, session-required (student OR parent). Steps:
//   1. Resolve the student from the session (student self, or parent's child).
//   2. Require VG linkage (students.vidya_grid_user_id) + VG enabled for school.
//   3. Require adaptive_learning_ai consent (DPDP gate).
//   4. Mint a short-lived (120s) HMAC-signed (HS256) launch token with LTI-shaped
//      claims, 302-redirect to {VIDYA_GRID_API_URL}/launch?token=...
//
// The SIGNING secret (VIDYA_GRID_LAUNCH_SECRET) never leaves the server; only the
// signed, short-lived token travels in the redirect URL. Fail-safe: missing
// config/linkage/consent never throws and never leaks a secret.

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { verifyStudentSession, STUDENT_SESSION_COOKIE } from '@/lib/student-auth';
import { getParentSession } from '@/lib/parent-auth';
import { getVidyaGridEntitlement } from '@/lib/vidya-grid-entitlement';
import { hasAdaptiveLearningConsent, hasAdaptiveLearningConsentForStudent } from '@/lib/vidya-grid-consent';
import { buildVgLaunchClaims } from '@/lib/vidya-grid-launch';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Resolve student (and parentId, if a parent is launching) from the session.
  let studentId: string | null = null;
  let parentId: string | null = null;

  const stSession = await verifyStudentSession(req.cookies.get(STUDENT_SESSION_COOKIE)?.value);
  if (stSession) {
    studentId = stSession.studentId;
  } else {
    const pSession = await getParentSession(req);
    if (pSession) { studentId = pSession.studentId; parentId = pSession.parentId; }
  }
  if (!studentId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const baseUrl = process.env.VIDYA_GRID_API_URL;
  const secret = process.env.VIDYA_GRID_LAUNCH_SECRET;
  if (!baseUrl || !secret) {
    return NextResponse.json({ error: 'Vidya Grid launch is not configured.', code: 'VG_NOT_CONFIGURED' }, { status: 503 });
  }

  const { data: student } = await supabaseAdmin
    .from('students').select('id, school_id, vidya_grid_user_id').eq('id', studentId).maybeSingle();
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  if (!student.vidya_grid_user_id) {
    return NextResponse.json({ error: 'This student is not linked to Vidya Grid yet.', code: 'VG_NOT_LINKED' }, { status: 409 });
  }

  const ent = await getVidyaGridEntitlement(student.school_id, student.id);
  if (ent.plan === 'none') {
    return NextResponse.json({ error: 'Vidya Grid is not enabled for your school.', code: 'VG_NOT_ENABLED' }, { status: 403 });
  }

  // Consent gate (DPDP).
  const consentOk = parentId
    ? await hasAdaptiveLearningConsent(parentId, student.school_id)
    : await hasAdaptiveLearningConsentForStudent(student.id, student.school_id);
  if (!consentOk) {
    // Clear consent path: a parent can grant it on the upgrade page; otherwise JSON.
    if (parentId) return NextResponse.redirect(new URL('/parent/vidya-grid/upgrade', req.url), 302);
    return NextResponse.json({ error: 'A parent must allow adaptive learning AI before launch.', code: 'CONSENT_REQUIRED' }, { status: 403 });
  }

  // VG school id (what VG recognises); fall back to EdProSys school id.
  const { data: school } = await supabaseAdmin
    .from('schools').select('vidya_grid_school_id').eq('id', student.school_id).maybeSingle();
  const vgSchoolId = (school?.vidya_grid_school_id as string) ?? student.school_id;

  const claims = buildVgLaunchClaims({
    erpStudentId: student.id,
    vgUserId: student.vidya_grid_user_id,
    schoolId: vgSchoolId,
    plan: ent.plan,
    paidActive: ent.paidActive,
    consentOk: true,
  });

  const token = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(secret));
  const url = `${baseUrl.replace(/\/+$/, '')}/launch?token=${encodeURIComponent(token)}`;
  return NextResponse.redirect(url, 302);
}
