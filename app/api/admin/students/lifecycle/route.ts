// app/api/admin/students/lifecycle/route.ts
// Real workflow: year-end → promote (handled separately via academic year)
// Mid-year: transfer to another school, deactivate dropout, graduate passout
// All state changes write to student_lifecycle_events for audit
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

type LifecycleAction = 'transfer' | 'graduate' | 'deactivate' | 'reactivate' | 'archive';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, userEmail } = ctx;

  let body: {
    student_ids: string[];
    action: LifecycleAction;
    notes?: string;
    to_school_id?: string;
    to_class?: string;
    to_section?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { student_ids, action, notes, to_school_id, to_class, to_section } = body;
  if (!student_ids?.length || !action) return NextResponse.json({ error: 'student_ids and action required' }, { status: 400 });

  const validActions = new Set(['transfer','graduate','deactivate','reactivate','archive']);
  if (!validActions.has(action)) return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });

  // Validate all student_ids belong to this school
  const { data: students, error: fetchErr } = await supabaseAdmin
    .from('students').select('id, name, class, section, graduation_status, is_active')
    .in('id', student_ids).eq('school_id', schoolId);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const found = new Set((students ?? []).map(s => s.id));
  const notFound = student_ids.filter(id => !found.has(id));
  if (notFound.length) return NextResponse.json({ error: `Students not found: ${notFound.join(', ')}` }, { status: 404 });

  const results: { id: string; name: string; status: 'ok' | 'error'; message?: string }[] = [];
  const now = new Date().toISOString();

  for (const student of students ?? []) {
    try {
      let studentUpdate: Record<string, unknown> = {};
      let fromStatus = student.graduation_status ?? (student.is_active ? 'active' : 'inactive');
      let toStatus = fromStatus;

      switch (action) {
        case 'transfer':
          if (!to_school_id) { results.push({ id: student.id, name: student.name, status: 'error', message: 'to_school_id required for transfer' }); continue; }
          studentUpdate = { school_id: to_school_id, is_active: true };
          if (to_class) studentUpdate.class = to_class;
          if (to_section) studentUpdate.section = to_section;
          fromStatus = 'active'; toStatus = 'transferred';
          break;
        case 'graduate':
          studentUpdate = { graduation_status: 'graduated', graduated_at: now, is_active: false };
          fromStatus = 'active'; toStatus = 'graduated';
          break;
        case 'deactivate':
          studentUpdate = { is_active: false };
          fromStatus = 'active'; toStatus = 'inactive';
          break;
        case 'reactivate':
          studentUpdate = { is_active: true, graduation_status: null };
          fromStatus = 'inactive'; toStatus = 'active';
          break;
        case 'archive':
          studentUpdate = { is_active: false, graduation_status: 'archived' };
          fromStatus = student.graduation_status ?? 'inactive'; toStatus = 'archived';
          break;
      }

      const { error: updateErr } = await supabaseAdmin
        .from('students').update(studentUpdate).eq('id', student.id);
      if (updateErr) { results.push({ id: student.id, name: student.name, status: 'error', message: updateErr.message }); continue; }

      // Audit log
      await supabaseAdmin.from('student_lifecycle_events').insert({
        student_id: student.id,
        school_id: schoolId,
        from_status: fromStatus,
        to_status: toStatus,
        triggered_by: userEmail,
        notes: notes ?? null,
        from_school_id: schoolId,
        to_school_id: action === 'transfer' ? to_school_id : null,
        to_class: action === 'transfer' ? (to_class ?? null) : null,
        to_section: action === 'transfer' ? (to_section ?? null) : null,
        metadata: { action },
      });

      results.push({ id: student.id, name: student.name, status: 'ok' });
    } catch (e) {
      results.push({ id: student.id, name: student.name, status: 'error', message: String(e) });
    }
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const errors = results.filter(r => r.status === 'error');
  return NextResponse.json({ success: true, action, processed: ok, errors, results });
}
