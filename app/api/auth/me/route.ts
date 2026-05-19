import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// GET /api/auth/me
// Returns current user identity for UI header/layout population.
// 401 when no session — allows layout to redirect to login.

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const [schoolUserRes, schoolRes] = await Promise.allSettled([
    supabaseAdmin
      .from('school_users')
      .select('id, staff_id, staff:staff_id(name)')
      .eq('id', session.userId)
      .single(),
    supabaseAdmin
      .from('schools')
      .select('name')
      .eq('id', session.schoolId)
      .single(),
  ]);

  const schoolUser = schoolUserRes.status === 'fulfilled' ? schoolUserRes.value.data : null;
  const school = schoolRes.status === 'fulfilled' ? schoolRes.value.data : null;

  // Resolve name from staff join — supabase returns joined row as object or array
  let staffName: string | null = null;
  if (schoolUser?.staff) {
    const raw = schoolUser.staff as unknown;
    if (Array.isArray(raw)) {
      staffName = (raw[0] as { name?: string } | undefined)?.name ?? null;
    } else {
      staffName = (raw as { name?: string } | null)?.name ?? null;
    }
  }

  const name = staffName ?? session.userName ?? session.userEmail.split('@')[0];

  return NextResponse.json({
    id: session.userId,
    name,
    email: session.userEmail,
    role: session.userRole,
    school_id: session.schoolId,
    school_name: school?.name ?? session.schoolName ?? '',
    staff_id: (schoolUser as { staff_id?: string } | null)?.staff_id ?? null,
  });
}
