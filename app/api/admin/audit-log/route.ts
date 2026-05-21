// app/api/admin/audit-log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner'].includes(session.userRole)) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const module = req.nextUrl.searchParams.get('module');
  const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');

  let q = supabaseAdmin
    .from('audit_log')
    .select('id, action, resource, user_id, ip, created_at, school_id, metadata')
    .eq('school_id', session.schoolId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // activity_logs has module field; audit_log uses resource field
  // Map module filter to resource prefix for audit_log
  if (module && module !== 'all') q = q.ilike('resource', `${module}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Merge with activity_logs for richer module coverage
  let actLogs: unknown[] = [];
  if (!module || module === 'all') {
    const { data: al } = await supabaseAdmin
      .from('activity_logs')
      .select('id, action, module, actor_email, details, created_at')
      .eq('school_id', session.schoolId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    actLogs = al ?? [];
  }

  const entries = [
    ...(data ?? []).map(r => ({ id: r.id, action: r.action, module: r.resource?.split('/')[0] ?? 'system', actor_email: null, created_at: r.created_at })),
    ...(actLogs as { id: string; action: string; module: string; actor_email: string; created_at: string }[]).map(r => ({ id: r.id, action: r.action, module: r.module, actor_email: r.actor_email, created_at: r.created_at })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
   .slice(0, limit);

  return NextResponse.json({ entries, total: entries.length });
}
