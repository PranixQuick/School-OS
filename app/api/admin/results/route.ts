// app/api/admin/results/route.ts
// Results publishing (workflow #10). Principal/admin/owner publishes a term's
// results: records published_at on academic_records, notifies parents (outbound),
// and alerts teachers + owner via the bell. Non-breaking: unpublished results are
// NOT hidden — the student marks view is unchanged; publishing adds the event +
// the parent notification.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { writeNotification } from '@/lib/notifications';
import { createStaffAlerts } from '@/lib/alerts';

export const runtime = 'nodejs';

const PUBLISH_ROLES = ['owner', 'principal', 'admin', 'admin_staff'];

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { data, error } = await supabaseAdmin
    .from('academic_records')
    .select('term, published_at')
    .eq('school_id', ctx.schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map: Record<string, { term: string; total: number; published: number }> = {};
  for (const r of (data ?? []) as any[]) {
    const t = r.term ?? '—';
    if (!map[t]) map[t] = { term: t, total: 0, published: 0 };
    map[t].total++;
    if (r.published_at) map[t].published++;
  }
  const terms = Object.values(map).sort((a, b) => a.term.localeCompare(b.term));
  return NextResponse.json({ terms });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  if (!PUBLISH_ROLES.includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Only principal, admin or owner can publish results' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const term = (body as any).term;
  if (!term || typeof term !== 'string') return NextResponse.json({ error: 'term is required' }, { status: 400 });

  // Mark this term's unpublished records as published.
  const { data: updated, error } = await supabaseAdmin
    .from('academic_records')
    .update({ published_at: new Date().toISOString(), published_by: ctx.userId })
    .eq('school_id', ctx.schoolId)
    .eq('term', term)
    .is('published_at', null)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const publishedCount = updated?.length ?? 0;

  // Outbound to parents/students that results are available.
  await writeNotification(supabaseAdmin, {
    school_id: ctx.schoolId,
    type: 'alert',
    title: 'Results published',
    message: `Results for ${term} are now available in the app.`,
    module: 'results_published',
  });

  // In-app: teachers + owner see that results went out.
  await createStaffAlerts({
    schoolId: ctx.schoolId,
    targetRoles: ['teacher', 'owner'],
    type: 'results_published',
    module: 'results',
    title: 'Results published',
    message: `Results for ${term} were published to students & parents.`,
    href: '/admin/results',
  });

  return NextResponse.json({ success: true, published_count: publishedCount });
}
