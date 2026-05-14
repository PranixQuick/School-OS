// app/api/student/logout/route.ts
// Batch 4D — Clear student_session cookie.

import { NextRequest, NextResponse } from 'next/server';
import { clearedStudentSessionCookie } from '@/lib/student-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';
  const res = NextResponse.json({ success: true });
  res.cookies.set(clearedStudentSessionCookie(isProduction));
  return res;
}
