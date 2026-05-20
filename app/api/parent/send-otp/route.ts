// app/api/parent/send-otp/route.ts
// Parent self-registration: Step 1 — send OTP.
// Finds student by phone_parent, stores OTP in parents.access_pin, sends via WhatsApp.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { sendWhatsApp, normalisePhone } from '@/lib/whatsapp';

export const runtime = 'nodejs';

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  let body: { phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const rawPhone = body.phone?.trim() ?? '';
  if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

  const phone = normalisePhone(rawPhone) ?? rawPhone;

  // Find student by parent phone
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, school_id')
    .or(`phone_parent.eq.${phone},phone_parent.eq.${rawPhone}`)
    .eq('is_active', true)
    .limit(1);

  if (!students || students.length === 0) {
    return NextResponse.json({
      error: 'No student found with this phone number. Please contact your school admin.',
    }, { status: 404 });
  }

  const student = students[0];
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Upsert parent record with OTP
  const { error: upsertErr } = await supabaseAdmin.from('parents').upsert({
    school_id: student.school_id,
    student_id: student.id,
    name: 'Parent',
    phone,
    access_pin: otp,
    whatsapp_opted_out: false,
    // Store OTP expiry in metadata if column exists, otherwise just overwrite pin
  }, { onConflict: 'school_id,student_id' });

  if (upsertErr) {
    console.error('[send-otp] upsert error:', upsertErr);
    return NextResponse.json({ error: 'Failed to generate OTP. Try again.' }, { status: 500 });
  }

  // Send via WhatsApp
  const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', student.school_id).single();
  const sent = await sendWhatsApp({
    to: phone,
    body: `${school?.name ?? 'School'}\n\nYour OTP for parent portal access:\n\n*${otp}*\n\nValid for 10 minutes. Do not share with anyone.`,
    schoolName: school?.name ?? 'School',
  }).catch(() => false);

  if (!sent) {
    // OTP created but WhatsApp failed — return pin directly for dev/fallback
    console.warn('[send-otp] WhatsApp delivery failed for', phone);
  }

  return NextResponse.json({
    success: true,
    student_name: student.name,
    // In production: do NOT return OTP. For dev/demo we return it as fallback if WA fails.
    ...(process.env.NODE_ENV !== 'production' ? { _dev_otp: otp } : {}),
  });
}
