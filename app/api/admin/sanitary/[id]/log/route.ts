// app/api/admin/sanitary/[id]/log/route.ts
// Batch 4E — Dispensing log for an inventory item.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0,10);
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0,10);

  const { data, error } = await supabaseAdmin
    .from('pad_dispensing_log')
    .select('id, dispensed_at, quantity, notes, students(name, class, section), staff(name)')
    .eq('school_id', schoolId)
    .eq('inventory_id', id)
    .gte('dispensed_at', from)
    .lte('dispensed_at', to + 'T23:59:59')
    .order('dispensed_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const logs = (data ?? []).map(l => {
    const st = Array.isArray(l.students) ? l.students[0] : l.students as { name?: string; class?: string; section?: string } | null;
    const staff = Array.isArray(l.staff) ? l.staff[0] : l.staff as { name?: string } | null;
    return {
      id: l.id, dispensed_at: l.dispensed_at, quantity: l.quantity, notes: l.notes,
      student_name: st?.name ?? null, student_class: st?.class, student_section: st?.section,
      staff_name: staff?.name ?? '—',
    };
  });

  return NextResponse.json({ logs, count: logs.length, from, to });
}
