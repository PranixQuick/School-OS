// app/api/admin/students/[id]/set-pin/route.ts
// Batch 4D — Admin sets student login PIN.
// PIN stored plain-text matching parent auth pattern (no bcrypt).

import { NextRequest, NextResponse } from 'next/server';
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
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { pin, enable_login } = body as { pin?: string; enable_login?: boolean };
  if (!pin) return NextResponse.json({ error: 'pin required' }, { status: 400 });
  if (!/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });

  const patch: Record<string, unknown> = {
    access_pin: pin, // plain text — matches parent pattern
    pin_set_at: new Date().toISOString(),
    student_login_enabled: enable_login ?? true,
  };

  const { error } = await supabaseAdmin
    .from('students')
    .update(patch)
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
