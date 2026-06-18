// app/api/admin/vendors/route.ts
// Real workflow: admin maintains list of contracted vendors with contact info.
// ISS-7: admin can also grant/revoke a vendor portal login (has_portal_access,
// portal_email, and a bcrypt PIN) so vendors can sign in to /vendor.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ vendors: [] });

  const vendorType = req.nextUrl.searchParams.get('type');
  let q = supabaseAdmin.from('vendors').select('*')
    .eq('institution_id', school.institution_id).eq('is_active', true).order('name');
  if (vendorType) q = q.eq('vendor_type', vendorType);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vendors: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.name || typeof body.name !== 'string') return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin.from('vendors').insert({
    institution_id: school.institution_id, school_id: schoolId,
    name: (body.name as string).trim(),
    vendor_type: body.vendor_type ?? 'other',
    contact_name: body.contact_name ?? null,
    contact_phone: body.contact_phone ?? null,
    contact_email: body.contact_email ?? null,
    gst_number: body.gst_number ?? null,
    address: body.address ?? null,
    contract_start: body.contract_start ?? null,
    contract_end: body.contract_end ?? null,
    notes: body.notes ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vendor: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const allowed = ['name','vendor_type','contact_name','contact_phone','contact_email','gst_number','address','contract_start','contract_end','notes','is_active','has_portal_access','portal_email'];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];

  // Normalize portal_email (used as the vendor's login id).
  if (typeof update.portal_email === 'string') update.portal_email = update.portal_email.trim().toLowerCase() || null;

  // ISS-7: grant portal access by setting a PIN. Hash it and enable access.
  if (typeof body.portal_pin === 'string' && body.portal_pin.trim()) {
    update.access_pin_hashed = await bcrypt.hash(body.portal_pin.trim(), 10);
    update.has_portal_access = true;
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('vendors').update(update)
    .eq('id', body.id as string).eq('institution_id', school?.institution_id ?? '')
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vendor: data });
}
