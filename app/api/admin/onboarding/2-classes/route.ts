// app/api/admin/onboarding/2-classes/route.ts
// Onboarding Step 2: Classes + sections
// Body: { classes: [{ grade: string, sections: string[] }] }
// Idempotent: skips classes that already exist (ON CONFLICT DO NOTHING).
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
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const classes = (body.classes as { grade: string; sections: string[] }[]) ?? [];
  if (!classes.length) return NextResponse.json({ error: 'classes array required' }, { status: 400 });
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const institutionId = school?.institution_id ?? null;
  const rows = classes.flatMap(c => (c.sections ?? ['A']).map(s => ({
    school_id: schoolId, institution_id: institutionId,
    grade_level: String(c.grade).trim(), section: String(s).trim().toUpperCase(), is_active: true,
  })));
  const { error } = await supabaseAdmin.from('classes').upsert(rows, { onConflict: 'school_id,academic_year_id,grade_level,section', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, step: 2, created: rows.length });
}
