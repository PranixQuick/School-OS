// lib/student-auth.ts
// Batch 4D — Student session auth.
// PIN stored as plain text matching parent auth pattern (access_pin direct compare).
// JWT via jose, same SESSION_SECRET as school_session, separate cookie name.
// Student routes added to PUBLIC_PATHS in middleware — middleware does NOT gate /student/*.
// requireStudentSession reads student_session cookie directly (not middleware headers).

import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { env } from '@/lib/env';

export const STUDENT_SESSION_COOKIE = 'student_session';
const STUDENT_SESSION_EXPIRY = '7d';
const STUDENT_SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const ALG = 'HS256';
const ISSUER = 'school-os-student';

export interface StudentSession {
  studentId: string;
  schoolId: string;
  name: string;
  studentClass: string;
  section: string;
  role: 'student';
}

export class StudentAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'StudentAuthError';
    this.status = status;
  }
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function verifyStudentPin(
  admissionNumber: string,
  pin: string,
  schoolId: string
): Promise<{ id: string; name: string; class: string; section: string; school_id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('id, name, class, section, school_id, access_pin, student_login_enabled, is_active')
    .eq('admission_number', admissionNumber)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .eq('student_login_enabled', true)
    .maybeSingle();

  if (error || !data) return null;
  // Plain-text PIN compare — matches parent auth pattern
  if (data.access_pin !== pin) return null;

  // Stamp last login (non-fatal)
  await supabaseAdmin
    .from('students')
    .update({ last_student_login: new Date().toISOString() })
    .eq('id', data.id);

  return { id: data.id, name: data.name, class: data.class, section: data.section, school_id: data.school_id };
}

export async function issueStudentSession(student: {
  id: string; name: string; class: string; section: string; school_id: string;
}): Promise<string> {
  return await new SignJWT({
    studentId: student.id,
    schoolId: student.school_id,
    name: student.name,
    studentClass: student.class,
    section: student.section,
    role: 'student',
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setSubject(student.id)
    .setExpirationTime(STUDENT_SESSION_EXPIRY)
    .sign(secretKey());
}

export function studentSessionCookie(token: string, isProduction: boolean) {
  return {
    name: STUDENT_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: STUDENT_SESSION_MAX_AGE,
    path: '/',
  };
}

export function clearedStudentSessionCookie(isProduction: boolean) {
  return {
    name: STUDENT_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };
}

export async function verifyStudentSession(token: string | undefined | null): Promise<StudentSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      algorithms: [ALG],
    });
    if (typeof payload.studentId !== 'string' || typeof payload.schoolId !== 'string') return null;
    return {
      studentId: payload.studentId,
      schoolId: payload.schoolId,
      name: (payload.name as string) ?? '',
      studentClass: (payload.studentClass as string) ?? '',
      section: (payload.section as string) ?? '',
      role: 'student',
    };
  } catch {
    return null;
  }
}

export async function requireStudentSession(req: NextRequest): Promise<StudentSession> {
  const token = req.cookies.get(STUDENT_SESSION_COOKIE)?.value;
  const session = await verifyStudentSession(token);
  if (!session) throw new StudentAuthError('No student session', 401);
  return session;
}

// Helper: send JSON error from StudentAuthError
export function studentAuthResponse(e: unknown): NextResponse {
  if (e instanceof StudentAuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  throw e;
}
