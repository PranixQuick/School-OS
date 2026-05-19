import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// GET /api/auth/me
// Returns current session user identity for UI header population.
// Called by teacher layout, admin layout, and any component needing user context.
// Returns 401 (not 404) when session is absent — allows UI to redirect to login.

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  // Fetch name + school name in one parallel query
  const [schoolUserRes, schoolRes] = await Promise.allSettled([
    supabaseAdmin
      .from('school_users')
      .select('id, staff_id, staff(name)')
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

  // Extract name: prefer staff.name, fall back to email prefix
  const staffRow = schoolUser?.staff;
  const staffName = Array.isArray(staffRow)
    ? (staffRow[0] as { name: string } | undefined)?.name ?? null
    : (staffRow as { name: string } | null)?.name ?? null;

  const name = staffName ?? session.userEmail.split('@')[0];

  return NextResponse.json({
    id: session.userId,
    name,
    email: session.userEmail,
    role: session.userRole,
    school_id: session.schoolId,
    school_name: school?.name ?? '',
    staff_id: schoolUser?.staff_id ?? null,
  });
}
