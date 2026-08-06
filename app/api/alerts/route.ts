// app/api/alerts/route.ts
// The signed-in staff member's in-app alert feed (public.staff_alerts).
// GET  -> alerts targeted at this user's role or at them specifically, in their
//         active school, newest first, plus an unread count for the bell badge.
// PATCH-> mark one alert ({ id }) or all ({ all: true }) as read.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

function targetFilter(session: { userRole: string; userId: string }): string {
  // role-targeted OR user-targeted rows for this user.
  return `target_role.eq.${session.userRole},target_user_id.eq.${session.userId}`;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('staff_alerts')
    .select('id, type, module, title, message, reference_id, href, is_read, created_at')
    .eq('school_id', session.schoolId)
    .or(targetFilter(session))
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const alerts = data ?? [];
  const unread = alerts.filter(a => !a.is_read).length;
  return NextResponse.json({ alerts, unread });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, all } = body as { id?: string; all?: boolean };

  let q = supabaseAdmin
    .from('staff_alerts')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('school_id', session.schoolId)
    .or(targetFilter(session));

  if (!all) {
    if (!id) return NextResponse.json({ error: 'id or all is required' }, { status: 400 });
    q = q.eq('id', id);
  }

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
