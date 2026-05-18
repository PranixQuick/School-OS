// app/api/config/route.ts
// Returns current session context: role + institution_type for Layout navigation filtering.
// Consumed by Layout.tsx to avoid DB calls on every page render.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { schoolId, userRole, userEmail } = ctx;
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('name, settings')
    .eq('id', schoolId)
    .maybeSingle();
  const settings = (school?.settings as Record<string, unknown>) ?? {};
  return NextResponse.json({
    role: userRole,
    userEmail,
    schoolName: school?.name ?? '',
    institution_type: (settings['institution_type'] as string) ?? 'school_k12',
    ownership_type: (settings['ownership_type'] as string) ?? 'private',
    settings,
  });
}
