// app/api/owner/schools/[school_id]/settings/route.ts
// Batch 4C — Owner updates feature_flags for a specific school's institution.
// Validates school_id is owned by this owner.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireOwnerSession, OwnerAuthError } from '@/lib/owner-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ school_id: string }> }
) {
  let ctx;
  try { ctx = await requireOwnerSession(req); }
  catch (e) { if (e instanceof OwnerAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { school_id } = await params;

  // Validate ownership
  if (!ctx.schoolIds.includes(school_id)) {
    return NextResponse.json({ error: 'School not owned by this account' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { feature_flags_patch } = body as { feature_flags_patch?: Record<string, unknown> };
  if (!feature_flags_patch || !Object.keys(feature_flags_patch).length) {
    return NextResponse.json({ error: 'feature_flags_patch required' }, { status: 400 });
  }

  // Get the school's institution
  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', school_id).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'School institution not found' }, { status: 404 });

  // Fetch current flags then merge
  const { data: inst } = await supabaseAdmin
    .from('institutions').select('feature_flags').eq('id', school.institution_id).maybeSingle();
  const merged = { ...(inst?.feature_flags ?? {}), ...feature_flags_patch };

  const { data: updated, error } = await supabaseAdmin
    .from('institutions').update({ feature_flags: merged })
    .eq('id', school.institution_id).select('id, name, feature_flags').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ institution: updated });
}
