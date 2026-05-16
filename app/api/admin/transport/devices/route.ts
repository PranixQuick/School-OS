import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task B: Device token registration for K6 Bus GPS.
// Devices (Android GPS apps installed on buses) authenticate to the K6
// /api/transport/location endpoint using a per-device token. This route lets
// admin/principal create, list, and revoke those tokens.
//
// Token format: uuid v4. 36 chars, opaque. Stored in plain text in device_tokens.token.
// (Sensitivity: token grants ability to post a bus location for one route. If
// compromised, admin revokes via DELETE. Tokens are scoped per-route per-school.)

export const runtime = 'nodejs';

interface PostBody {
  device_name?: string;
  route_id?: string;
}

// ─── GET: list devices for caller's school ────────────────────────────────────

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdminSession(req);
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const { schoolId } = ctx;

  const { data, error } = await supabaseAdmin
    .from('device_tokens')
    .select(`
      id, device_name, token, route_id, last_seen, created_at,
      route:transport_routes!device_tokens_route_id_fkey ( id, route_name, route_number )
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Device list error:', error);
    return NextResponse.json({ error: 'Failed to load devices' }, { status: 500 });
  }

  // Mask token in response — return only first 8 chars + last 4 for identification
  const devices = (data ?? []).map(d => ({
    id: d.id,
    device_name: d.device_name,
    token_masked: d.token ? `${d.token.slice(0, 8)}…${d.token.slice(-4)}` : null,
    route_id: d.route_id,
    route: d.route,
    last_seen: d.last_seen,
    created_at: d.created_at,
  }));

  return NextResponse.json({ success: true, devices });
}

// ─── POST: issue new device token ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdminSession(req);
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const { schoolId } = ctx;

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const deviceName = body.device_name?.trim();
  const routeId = body.route_id?.trim() || null;

  if (!deviceName || deviceName.length < 1 || deviceName.length > 100) {
    return NextResponse.json({ error: 'device_name required (1-100 characters)' }, { status: 400 });
  }

  // If a route is supplied, verify it belongs to this school
  if (routeId) {
    const { data: route } = await supabaseAdmin
      .from('transport_routes')
      .select('id, school_id')
      .eq('id', routeId)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (!route) {
      return NextResponse.json({ error: 'route_id does not belong to this school' }, { status: 403 });
    }
  }

  const token = randomUUID();

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('device_tokens')
    .insert({
      school_id: schoolId,
      device_name: deviceName,
      route_id: routeId,
      token,
    })
    .select('id, device_name, token, route_id, created_at')
    .single();

  if (insertErr || !inserted) {
    console.error('Device insert error:', insertErr);
    return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
  }

  // Return full token ONCE — caller must copy it now.
  return NextResponse.json({
    success: true,
    device: inserted,
    note: 'Copy the token now. For security, the token will be masked on subsequent reads.',
  });
}

// ─── DELETE: revoke device token ──────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdminSession(req);
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const { schoolId } = ctx;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('device_tokens')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    console.error('Device delete error:', error);
    return NextResponse.json({ error: 'Failed to revoke device' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
