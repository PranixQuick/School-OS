import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { randomUUID } from 'crypto';

// PR-2 Task B: Device token registration for GPS bus tracking.
// Admin/owner/principal can issue a token for a bus device, assigned to a route.
// The Android GPS app uses this token to authenticate POSTs to /api/transport/location.
// Token format: uuid v4 (no need for crypto-strength; the device_tokens row IS the secret).
//
// GET  /api/admin/transport/devices                 -> list all tokens for this school
// POST /api/admin/transport/devices { route_id?, device_name } -> issue new token

export const runtime = 'nodejs';

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

  try {
    const { data: devices, error } = await supabaseAdmin
      .from('device_tokens')
      .select(`
        id, token, device_name, last_seen, created_at, route_id,
        route:transport_routes!device_tokens_route_id_fkey(id, route_name, route_number)
      `)
      .eq('school_id', ctx.schoolId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[admin-devices] list error:', error);
      return NextResponse.json({ error: 'Failed to load devices' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total: devices?.length ?? 0,
      devices: devices ?? [],
    });
  } catch (err) {
    console.error('[admin-devices] GET error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

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

  let body: { route_id?: string | null; device_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const deviceName = (body.device_name ?? '').trim();
  if (!deviceName || deviceName.length > 100) {
    return NextResponse.json({ error: 'device_name required (1-100 chars)' }, { status: 400 });
  }

  // Validate route belongs to this school (if provided)
  if (body.route_id) {
    const { data: route } = await supabaseAdmin
      .from('transport_routes')
      .select('id, school_id')
      .eq('id', body.route_id)
      .maybeSingle();
    if (!route || route.school_id !== ctx.schoolId) {
      return NextResponse.json({ error: 'Route not found in this school' }, { status: 400 });
    }
  }

  const token = randomUUID();

  const { data: inserted, error: iErr } = await supabaseAdmin
    .from('device_tokens')
    .insert({
      school_id: ctx.schoolId,
      route_id: body.route_id ?? null,
      device_name: deviceName,
      token,
    })
    .select('id, token, device_name, route_id, created_at')
    .single();

  if (iErr || !inserted) {
    console.error('[admin-devices] insert error:', iErr);
    return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    device: inserted,
    setup_instructions: 'Copy the token above and paste it into the Android GPS app on this bus device. The token is shown only once — store it securely.',
  }, { status: 201 });
}

// DELETE  /api/admin/transport/devices?id=<uuid>  -> revoke a token
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

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('device_tokens')
    .delete()
    .eq('id', id)
    .eq('school_id', ctx.schoolId);

  if (error) {
    console.error('[admin-devices] delete error:', error);
    return NextResponse.json({ error: 'Failed to revoke device' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
