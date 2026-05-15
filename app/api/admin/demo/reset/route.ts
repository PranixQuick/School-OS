import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { env } from '@/lib/env';

// G4: Demo reset endpoint — super-admin only
// Clears transactional data for Suchitra Academy to restore clean demo state
export const runtime = 'nodejs';

const SUCHITRA_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { userEmail } = ctx;
  const superAdminEmail = env.SUPER_ADMIN_EMAIL ?? 'pranixailabs@gmail.com';
  if (userEmail !== superAdminEmail) {
    return NextResponse.json({ error: 'super admin only' }, { status: 403 });
  }

  // Verify target school is the demo school
  const { data: school } = await supabaseAdmin
    .from('schools').select('id, name').eq('id', SUCHITRA_SCHOOL_ID).maybeSingle();
  if (!school) return NextResponse.json({ error: 'demo school not found' }, { status: 404 });

  // Delete transactional data in order (FK safe)
  await supabaseAdmin.from('homework_submissions').delete().eq('school_id', SUCHITRA_SCHOOL_ID);
  await supabaseAdmin.from('attendance').delete().eq('school_id', SUCHITRA_SCHOOL_ID);
  await supabaseAdmin.from('cron_runs').delete().eq('school_id', SUCHITRA_SCHOOL_ID);
  await supabaseAdmin.from('error_logs').delete().eq('school_id', SUCHITRA_SCHOOL_ID);

  return NextResponse.json({
    reset: true,
    school: school.name,
    cleared: ['homework_submissions', 'attendance', 'cron_runs', 'error_logs'],
  });
}
