// app/api/admin/parents/route.ts
// Batch 10 — List parents for admin management.
// Auth: requireAdminSession.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data, error } = await supabaseAdmin
    .from('parents')
    .select('id, name, phone, student_id, last_access, whatsapp_opted_out, students(name, class, section)')
    .eq('school_id', schoolId)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parents = (data ?? []).map(p => {
    const student = Array.isArray(p.students) ? p.students[0] : p.students as { name: string; class: string; section: string } | null;
    return {
      id: p.id,
      name: p.name,
      phone: p.phone,
      student_name: student?.name ?? null,
      student_class: student ? `Grade ${student.class ?? '?'}${student.section ? '-' + student.section : ''}` : null,
      last_access: p.last_access,
      whatsapp_opted_out: p.whatsapp_opted_out ?? false,
    };
  });

  return NextResponse.json({ parents });
}
