// app/api/owner/schools/route.ts
// Batch 4C — List all schools in owner's institution.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireOwnerSession, OwnerAuthError } from '@/lib/owner-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireOwnerSession(req); }
  catch (e) { if (e instanceof OwnerAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { data, error } = await supabaseAdmin
    .from('schools')
    .select('id, name, address, contact_email, contact_phone, is_active, onboarded_at, plan, institution_id')
    .eq('institution_id', ctx.institutionId)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schools: data ?? [], count: data?.length ?? 0 });
}
