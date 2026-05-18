// app/api/admin/onboarding/1-profile/route.ts
// Onboarding Step 1: School profile.
// FIX: institution_type and ownership_type now persisted to schools.settings JSONB.
// This was the root cause of all conditional feature gating failures — values
// only went to institutions table (via institution_id) which was NULL for all schools.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { name, address, board, institution_type, ownership_type, phone, logo_url, lat, lng } =
    body as Record<string, string | number | undefined>;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const latNum = lat === '' || lat === undefined || lat === null ? null : Number(lat);
  const lngNum = lng === '' || lng === undefined || lng === null ? null : Number(lng);
  if ((latNum === null) !== (lngNum === null))
    return NextResponse.json({ error: 'lat and lng must both be provided or both omitted' }, { status: 400 });
  if (latNum !== null) {
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90)
      return NextResponse.json({ error: 'lat must be a number between -90 and 90' }, { status: 400 });
    if (Number.isNaN(lngNum as number) || (lngNum as number) < -180 || (lngNum as number) > 180)
      return NextResponse.json({ error: 'lng must be a number between -180 and 180' }, { status: 400 });
  }
  const instType = typeof institution_type === 'string' ? institution_type.trim() : null;
  const ownType = typeof ownership_type === 'string' ? ownership_type.trim() : null;
  // Merge institution_type/ownership_type into existing settings JSONB
  const { data: existing } = await supabaseAdmin.from('schools').select('settings').eq('id', schoolId).maybeSingle();
  const existingSettings = (existing?.settings as Record<string, unknown>) ?? {};
  const newSettings: Record<string, unknown> = {
    ...existingSettings,
    ...(instType ? { institution_type: instType } : {}),
    ...(ownType ? { ownership_type: ownType } : {}),
  };
  const schoolUpdate: Record<string, unknown> = {
    name: (name as string).trim(),
    address: typeof address === 'string' ? address.trim() : null,
    board: typeof board === 'string' ? board.trim() : null,
    contact_phone: typeof phone === 'string' ? phone.trim() : null,
    logo_url: typeof logo_url === 'string' ? logo_url.trim() : null,
    settings: newSettings,
  };
  if ('lat' in body) schoolUpdate.lat = latNum;
  if ('lng' in body) schoolUpdate.lng = lngNum;
  const { error: sErr } = await supabaseAdmin.from('schools').update(schoolUpdate).eq('id', schoolId);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (school?.institution_id) {
    await supabaseAdmin.from('institutions').update({
      name: (name as string).trim(),
      address: typeof address === 'string' ? address.trim() : null,
      board: typeof board === 'string' ? board.trim() : null,
      contact_phone: typeof phone === 'string' ? phone.trim() : null,
      institution_type: instType,
      ownership_type: ownType,
    }).eq('id', school.institution_id);
  }
  return NextResponse.json({ success: true, step: 1, institution_type: instType, ownership_type: ownType });
}
