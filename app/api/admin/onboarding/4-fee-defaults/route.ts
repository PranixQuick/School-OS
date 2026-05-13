// app/api/admin/onboarding/4-fee-defaults/route.ts
// Onboarding Step 4: Fee defaults (optional — creates pending fee rows per class)
// Body: { fee_defaults: [{ fee_type, amount, due_date, class? }] }
// Creates one fee row per student in each matching class (or all classes if class omitted).
// Idempotent: skips if student already has a fee of this type due on this date.
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const defaults = (body.fee_defaults as { fee_type: string; amount: number; due_date: string; class?: string }[]) ?? [];
  if (!defaults.length) return NextResponse.json({ success: true, step: 4, created: 0, note: 'No fee defaults provided — skipped' });
  // Fetch all active students for this school
  const { data: students } = await supabaseAdmin.from('students').select('id, class').eq('school_id', schoolId).eq('is_active', true);
  let created = 0;
  for (const d of defaults) {
    if (!d.fee_type || !d.amount || !d.due_date) continue;
    const targets = d.class ? (students ?? []).filter(s => s.class === d.class) : (students ?? []);
    if (!targets.length) continue;
    const rows = targets.map(s => ({
      school_id: schoolId, student_id: s.id, amount: d.amount, original_amount: d.amount,
      fee_type: d.fee_type, due_date: d.due_date, status: 'pending',
    }));
    const { error, data: inserted } = await supabaseAdmin.from('fees').insert(rows).select('id');
    if (!error) created += (inserted ?? []).length;
  }
  return NextResponse.json({ success: true, step: 4, created });
}
