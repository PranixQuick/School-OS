// app/api/admin/invite-management/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner','principal'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin.from('school_users')
    .select('id, email, name, role, invite_status, auth_verified, last_login, invited_at, invite_sent_at, auth_user_id')
    .eq('school_id', session.schoolId)
    .eq('is_active', true)
    .order('invite_status', { ascending: true })
    .order('invited_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}
