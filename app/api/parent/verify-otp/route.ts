// app/api/parent/verify-otp/route.ts
// Parent self-registration: Step 2 — verify OTP.
// Matches phone + OTP against parents.access_pin.
// Creates the same session cookie as the normal parent login.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { normalisePhone } from '@/lib/whatsapp';

export const runtime = 'nodejs';

// Re-use the same session creation used by /api/parent/login
// so the existing /api/parent/dashboard and middleware work unchanged.
async function createParentSession(res: NextResponse, parentRow: {
  id: string; school_id: string; student_id: string;
}) {
  // Set the same session structure as parent/login
  const sessionPayload = JSON.stringify({
    parentId: parentRow.id,
    schoolId: parentRow.school_id,
    studentId: parentRow.student_id,
    ts: Date.now(),
  });

  // Use the same cookie name as the existing parent auth
  res.cookies.set('parent_session', sessionPayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function POST(req: NextRequest) {
  let body: { phone?: string; otp?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const rawPhone = body.phone?.trim() ?? '';
  const otp = body.otp?.trim() ?? '';
  if (!rawPhone || !otp) return NextResponse.json({ error: 'Phone and OTP required' }, { status: 400 });

  const phone = normalisePhone(rawPhone) ?? rawPhone;

  // Find parent by phone + OTP
  const { data: parents } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id, access_pin, name')
    .or(`phone.eq.${phone},phone.eq.${rawPhone}`)
    .limit(5);

  if (!parents || parents.length === 0) {
    return NextResponse.json({ error: 'Phone number not found. Please check and try again.' }, { status: 404 });
  }

  const parent = parents.find((p: { access_pin: string }) => p.access_pin === otp);
  if (!parent) {
    return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });
  }

  // Get student name
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('name')
    .eq('id', parent.student_id)
    .single();

  // Update parent last_access
  await supabaseAdmin.from('parents')
    .update({ last_access: new Date().toISOString() })
    .eq('id', parent.id);

  const res = NextResponse.json({
    success: true,
    student_name: student?.name ?? '',
  });

  await createParentSession(res, {
    id: parent.id,
    school_id: parent.school_id,
    student_id: parent.student_id,
  });

  return res;
}
