// app/api/principal/report-narratives/route.ts
// Batch 13 — Principal: list draft narratives pending approval.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requirePrincipalSession(req); }
  catch (e) { if (e instanceof PrincipalAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') ?? 'draft';

  const { data, error } = await supabaseAdmin
    .from('report_narratives')
    .select('id, student_id, term, narrative_text, status, generated_at, principal_notes, students(name, class, section)')
    .eq('school_id', schoolId)
    .eq('status', statusFilter)
    .order('generated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const narratives = (data ?? []).map(n => {
    const s = Array.isArray(n.students) ? n.students[0] as { name: string; class: string; section: string } | undefined : n.students as { name: string; class: string; section: string } | null;
    return { id: n.id, student_id: n.student_id, student_name: s?.name ?? '—', student_class: s?.class ?? '?', student_section: s?.section ?? '', term: n.term, narrative_text: n.narrative_text, status: n.status, generated_at: n.generated_at, principal_notes: n.principal_notes };
  });

  return NextResponse.json({ narratives, count: narratives.length });
}
