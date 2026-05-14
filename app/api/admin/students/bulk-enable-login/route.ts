// app/api/admin/students/bulk-enable-login/route.ts
// Batch 4D — Bulk enable student login with auto-generated PINs.
// PIN patterns: last4_admission | dob_ddmm | custom.
// Plain-text storage matching parent auth pattern.

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

  const { studentClass, section, default_pin_pattern, custom_pin } = body as {
    studentClass?: string; section?: string;
    default_pin_pattern?: 'last4_admission' | 'dob_ddmm' | 'custom';
    custom_pin?: string;
  };
  if (!default_pin_pattern) return NextResponse.json({ error: 'default_pin_pattern required' }, { status: 400 });
  if (default_pin_pattern === 'custom' && !custom_pin) return NextResponse.json({ error: 'custom_pin required for custom pattern' }, { status: 400 });
  if (custom_pin && !/^\d{4,6}$/.test(custom_pin)) return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });

  let query = supabaseAdmin
    .from('students')
    .select('id, admission_number, date_of_birth')
    .eq('school_id', schoolId)
    .eq('is_active', true);
  if (studentClass) query = query.eq('class', studentClass);
  if (section) query = query.eq('section', section);

  const { data: students, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!students?.length) return NextResponse.json({ enabled: 0, note: 'No matching students' });

  const now = new Date().toISOString();
  let enabled = 0;
  const BATCH = 50;

  for (let i = 0; i < students.length; i += BATCH) {
    const chunk = students.slice(i, i + BATCH);
    const updates = chunk.map(s => {
      let pin: string;
      if (default_pin_pattern === 'last4_admission') {
        pin = (s.admission_number ?? '').slice(-4).padStart(4, '0');
      } else if (default_pin_pattern === 'dob_ddmm' && s.date_of_birth) {
        const d = new Date(s.date_of_birth);
        pin = String(d.getDate()).padStart(2,'0') + String(d.getMonth()+1).padStart(2,'0');
      } else {
        pin = custom_pin ?? '0000';
      }
      return { id: s.id, access_pin: pin, pin_set_at: now, student_login_enabled: true };
    });

    for (const u of updates) {
      const { error: uErr } = await supabaseAdmin
        .from('students')
        .update({ access_pin: u.access_pin, pin_set_at: u.pin_set_at, student_login_enabled: u.student_login_enabled })
        .eq('id', u.id)
        .eq('school_id', schoolId);
      if (!uErr) enabled++;
    }
  }

  return NextResponse.json({ enabled, total: students.length });
}
