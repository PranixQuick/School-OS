// app/api/admin/parents/resend-pin/route.ts
// Real workflow: parent lost/forgot PIN → admin clicks "Resend PIN" in parent list
// Queues a WhatsApp notification with existing PIN (or new one if regenerate=true)
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { parent_id: string; regenerate?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.parent_id) return NextResponse.json({ error: 'parent_id required' }, { status: 400 });

  // Fetch parent
  const { data: parent, error: pErr } = await supabaseAdmin
    .from('parents').select('id, name, phone, access_pin, access_pin_hashed, student_id')
    .eq('id', body.parent_id).eq('school_id', schoolId).maybeSingle();
  if (pErr || !parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  if (!parent.phone) return NextResponse.json({ error: 'Parent has no phone number on record' }, { status: 422 });

  let pin = parent.access_pin ?? '----';

  // If regenerating, create a new 4-digit PIN
  if (body.regenerate || !parent.access_pin) {
    pin = String(Math.floor(1000 + Math.random() * 9000));
    await supabaseAdmin.from('parents').update({ access_pin: pin }).eq('id', parent.id);
  }

  // Fetch student name for the message
  let studentName = 'your child';
  if (parent.student_id) {
    const { data: s } = await supabaseAdmin.from('students').select('name').eq('id', parent.student_id).maybeSingle();
    if (s?.name) studentName = s.name;
  }

  // Queue WhatsApp notification
  await supabaseAdmin.from('notifications').insert({
    school_id: schoolId,
    type: 'parent_pin_resend',
    title: 'EdProSys Parent Portal',
    message: `Hello ${parent.name}, your login PIN for the EdProSys parent portal is: *${pin}*\n\nStudents: ${studentName}\nLogin: edprosys.com/parent\n\nUse your registered phone number and this PIN to access homework, fees, attendance and more.`,
    module: 'credentials',
    status: 'pending',
    channel: 'whatsapp',
    template_vars: {
      phone: parent.phone,
      name: parent.name,
      pin,
      student_name: studentName,
      portal_url: 'https://www.edprosys.com/parent',
    },
  });

  return NextResponse.json({ success: true, message: 'PIN resend queued via WhatsApp.' });
}
