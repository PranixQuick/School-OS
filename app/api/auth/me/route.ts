import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// GET /api/auth/me
// Returns the current user's display information for Layout components.
// Both admin Layout.tsx and teacher layout.tsx call this on every page load.
// Was 404 — caused all sidebar names, school names, and role-based nav to silently fail.
//
// Returns 401 if no valid session.
// Returns 200 with { id, name, email, role, school_id, school_name, staff_id }

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const { schoolId, userId, userRole, userEmail } = session;

  // Fetch school name and staff name in parallel
  const [schoolRes, staffRes] = await Promise.allSettled([
    supabaseAdmin
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single(),
    supabaseAdmin
      .from('school_users')
      .select('id, staff_id')
      .eq('school_id', schoolId)
      .eq('email', userEmail)
      .maybeSingle(),
  ]);

  const schoolName = schoolRes.status === 'fulfilled'
    ? (schoolRes.value.data?.name ?? '')
    : '';

  const schoolUser = staffRes.status === 'fulfilled' ? staffRes.value.data : null;
  const staffId = schoolUser?.staff_id ?? null;

  // Get display name from staff record if available
  let displayName = '';
  if (staffId) {
    const { data: staffRow } = await supabaseAdmin
      .from('staff')
      .select('name')
      .eq('id', staffId)
      .single();
    displayName = staffRow?.name ?? '';
  }

  // Fall back to email prefix if no staff name
  if (!displayName) {
    displayName = userEmail.split('@')[0].replace(/[._]/g, ' ')
      .split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  return NextResponse.json({
    id: userId,
    name: displayName,
    email: userEmail,
    role: userRole,
    school_id: schoolId,
    school_name: schoolName,
    staff_id: staffId,
  });
}
