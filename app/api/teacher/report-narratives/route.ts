// app/api/teacher/report-narratives/route.ts
// Batch 13 — List narratives for teacher's students by term/class/section.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireTeacherSession(req); }
  catch (e) { if (e instanceof TeacherAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { searchParams } = new URL(req.url);
  const term = searchParams.get('term');
  const classFilter = searchParams.get('class');
  const section = searchParams.get('section');

  // Fetch narratives + student info
  let query = supabaseAdmin
    .from('report_narratives')
    .select('id, student_id, term, narrative_text, status, generated_at, approved_at, students(name, class, section)')
    .eq('school_id', schoolId)
    .order('generated_at', { ascending: false });

  if (term) query = query.eq('term', term);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by class/section client-side (nested join filter not straightforward)
  const narratives = (data ?? []).filter(n => {
    const s = Array.isArray(n.students) ? n.students[0] : n.students as { class?: string; section?: string } | null;
    if (classFilter && s?.class !== classFilter) return false;
    if (section && s?.section !== section) return false;
    return true;
  }).map(n => {
    const s = Array.isArray(n.students) ? n.students[0] as { name: string; class: string; section: string } | undefined : n.students as { name: string; class: string; section: string } | null;
    return { id: n.id, student_id: n.student_id, student_name: s?.name ?? '—', student_class: s?.class ?? '?', student_section: s?.section ?? '', term: n.term, narrative_text: n.narrative_text, status: n.status, generated_at: n.generated_at, approved_at: n.approved_at };
  });

  return NextResponse.json({ narratives });
}
