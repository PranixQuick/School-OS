import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task B: GPS device token registration API.
// Tokens are consumed by the existing K6 endpoint /api/transport/location
// (which is unauthenticated by session — bus device sends its token in the body).
//
// GET    /api/admin/transport/devices             → list tokens for school
// POST   /api/admin/transport/devices             → issue new token
//          body: { device_name: string, route_id?: string }
// DELETE /api/admin/transport/devices?token=...   → revoke a token

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { data, error } = await supabaseAdmin
    .from('device_tokens')
    .select(`
      id, token, device_name, last_seen, created_at, route_id,
      route:transport_routes(id, route_name, route_number)
    `)
    .eq('school_id', ctx.schoolId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Device tokens list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask tokens in list view — full token shown only on issuance
  const devices = (data ?? []).map(d => ({
    id: d.id,
    device_name: d.device_name,
    last_seen: d.last_seen,
    created_at: d.created_at,
    route_id: d.route_id,
    route: d.route,
    token_preview: d.token ? `${d.token.slice(0, 8)}…${d.token.slice(-4)}` : null,
  }));

  return NextResponse.json({ success: true, total: devices.length, devices });
}

interface CreateBody {
  device_name?: string;
  route_id?: string | null;
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  let body: CreateBody;
  try { body = await req.json() as CreateBody; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const deviceName = (body.device_name ?? '').trim();
  if (!deviceName) return NextResponse.json({ error: 'device_name is required' }, { status: 400 });
  if (deviceName.length > 100) return NextResponse.json({ error: 'device_name must be 100 characters or fewer' }, { status: 400 });

  // Optional route_id — must belong to the same school
  let routeId: string | null = null;
  if (body.route_id) {
    const { data: route } = await supabaseAdmin
      .from('transport_routes')
      .select('id, school_id')
      .eq('id', body.route_id)
      .maybeSingle();
    if (!route || route.school_id !== ctx.schoolId) {
      return NextResponse.json({ error: 'route_id not found in this school' }, { status: 400 });
    }
    routeId = route.id;
  }

  // UUID v4 — 36 chars, sufficient entropy for a long-lived bus device secret.
  const token = randomUUID();

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('device_tokens')
    .insert({
      school_id: ctx.schoolId,
      route_id: routeId,
      token,
      device_name: deviceName,
    })
    .select('id, token, device_name, route_id, created_at')
    .single();

  if (insErr || !inserted) {
    console.error('Device token insert error:', insErr);
    return NextResponse.json({ error: insErr?.message ?? 'Failed to issue token' }, { status: 500 });
  }

  // Return the full token ONCE on creation. UI must capture it now.
  return NextResponse.json({
    success: true,
    device: inserted,
    note: 'Full token shown ONCE. Copy it into the bus GPS device now — it will be masked in future listings.',
  });
}

export async function DELETE(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const id = url.searchParams.get('id');

  if (!token && !id) {
    return NextResponse.json({ error: 'token or id query param required' }, { status: 400 });
  }

  let query = supabaseAdmin.from('device_tokens').delete().eq('school_id', ctx.schoolId);
  if (id) query = query.eq('id', id);
  else if (token) query = query.eq('token', token);

  const { error } = await query;

  if (error) {
    console.error('Device token delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
