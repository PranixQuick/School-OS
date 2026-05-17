// app/api/admin/vendors/route.ts
// Vendor management: register and manage external service providers
// Real workflow: school maintains vendor contacts for transport, food, maintenance
// No complex procurement or billing — purely contact + contract dates
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  const vendorType = req.nextUrl.searchParams.get('type'); // transport|food|maintenance|other
  let q = supabaseAdmin
    .from('vendors')
    .select('id, name, vendor_type, contact_name, contact_phone, contact_email, gst_number, address, contract_start, contract_end, is_active, notes, created_at')
    .eq('school_id', schoolId)
    .order('name');

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

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name, vendor_type, contact_name, contact_phone, contact_email, gst_number, address, contract_start, contract_end, notes } = body;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const VALID_TYPES = new Set(['transport', 'food', 'maintenance', 'it', 'security', 'cleaning', 'other']);
  const vType = VALID_TYPES.has(String(vendor_type ?? '')) ? String(vendor_type) : 'other';

  const { data, error } = await supabaseAdmin.from('vendors').insert({
    institution_id: school?.institution_id ?? null,
    school_id: schoolId,
    name: String(name).trim(),
    vendor_type: vType,
    contact_name: contact_name ? String(contact_name).trim() : null,
    contact_phone: contact_phone ? String(contact_phone).trim() : null,
    contact_email: contact_email ? String(contact_email).trim().toLowerCase() : null,
    gst_number: gst_number ? String(gst_number).trim() : null,
    address: address ? String(address).trim() : null,
    contract_start: contract_start ? String(contract_start) : null,
    contract_end: contract_end ? String(contract_end) : null,
    notes: notes ? String(notes) : null,
    is_active: true,
  }).select('id, name, vendor_type, contact_phone').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vendor: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const update: Record<string, unknown> = {};
  const editable = ['name', 'vendor_type', 'contact_name', 'contact_phone', 'contact_email', 'gst_number', 'address', 'contract_start', 'contract_end', 'notes', 'is_active'];
  for (const k of editable) { if (k in fields) update[k] = fields[k] === '' ? null : fields[k]; }

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('vendors').update(update)
    .eq('id', String(id)).eq('school_id', schoolId)
    .select('id, name, is_active').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vendor: data });
}
