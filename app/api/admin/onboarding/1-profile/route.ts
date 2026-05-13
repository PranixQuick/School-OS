// app/api/admin/onboarding/1-profile/route.ts
// Onboarding Step 1: School profile (name, address, board, type, phone, logo URL)
// Updates both schools and institutions tables.
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
  const { name, address, board, institution_type, phone, logo_url } = body as Record<string, string>;
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  // Update schools table
  const { error: sErr } = await supabaseAdmin.from('schools').update({
    name: name.trim(), address: address?.trim() ?? null, board: board?.trim() ?? null,
    contact_phone: phone?.trim() ?? null, logo_url: logo_url?.trim() ?? null,
  }).eq('id', schoolId);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  // Update institutions table via school's institution_id
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (school?.institution_id) {
    await supabaseAdmin.from('institutions').update({
      name: name.trim(), address: address?.trim() ?? null, board: board?.trim() ?? null,
      contact_phone: phone?.trim() ?? null, institution_type: institution_type?.trim() ?? null,
    }).eq('id', school.institution_id);
  }
  return NextResponse.json({ success: true, step: 1 });
}
