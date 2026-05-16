// app/api/admin/parents/[id]/reset-pin/route.ts
// Batch 10 — Admin: reset parent PIN.
// access_pin is stored as plain text (confirmed: 4-digit plain string in DB).
// Auth: requireAdminSession.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id: parentId } = await params;

  // Verify parent belongs to this school
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, phone, name, student_id')
    .eq('id', parentId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });

  // Generate new 4-digit PIN (plain text — matches existing auth pattern)
  const newPin = Math.floor(1000 + Math.random() * 9000).toString();

  // Update PIN
  const { error: updateErr } = await supabaseAdmin
    .from('parents')
    .update({ access_pin: newPin })
    .eq('id', parentId)
    .eq('school_id', schoolId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Get student name for notification
  const { data: student } = await supabaseAdmin
    .from('students').select('name').eq('id', parent.student_id).maybeSingle();
  const studentName = student?.name ?? 'your child';

  // Send WhatsApp notification (best-effort)
  try {
    await supabaseAdmin.from('notifications').insert({
      school_id: schoolId,
      student_id: parent.student_id,
      type: 'broadcast',
      module: 'admin',
      title: 'Your new EdProSys PIN',
      message: `Your new login PIN is: ${newPin}. Use this with your phone number (${parent.phone}) to login at the parent portal. This PIN is for ${studentName}.`,
      status: 'pending',
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, pin_sent_via_whatsapp: true });
}
