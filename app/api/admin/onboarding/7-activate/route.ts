// app/api/admin/onboarding/7-activate/route.ts
// Onboarding Step 7: Review + Activate
// Sets institutions.onboarded_at = NOW() to mark onboarding complete.
// onboarding_complete is determined by onboarded_at IS NOT NULL.
// Also sets schools.onboarded_at for the legacy schools table.
// Returns { success: true, redirect: '/admin' }
// TODO(item-15): migrate to supabaseForUser
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const now = new Date().toISOString();
  // Set schools.onboarded_at
  const { error: sErr } = await supabaseAdmin.from('schools').update({ onboarded_at: now }).eq('id', schoolId);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  // Set institutions.onboarded_at
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (school?.institution_id) {
    await supabaseAdmin.from('institutions').update({ onboarded_at: now }).eq('id', school.institution_id);
  }
  return NextResponse.json({ success: true, step: 7, redirect: '/admin', message: 'School is now active.' });
}
