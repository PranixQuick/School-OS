// app/api/admin/role-permissions/route.ts
// ISS-6 (#6) — Global role_permissions matrix editor (super-admin only).
// The table has no school_id (it's the platform-wide default matrix), so edits
// are restricted to platform super-admins (email-based gate).

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function gate(req: NextRequest): Promise<NextResponse | null> {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });
  if (!isSuperAdmin(session.userEmail)) return NextResponse.json({ error: 'Super-admin access only' }, { status: 403 });
  return null;
}

const COLS = 'id, role, module, can_view, can_create, can_edit, can_delete';
const FLAGS = ['can_view', 'can_create', 'can_edit', 'can_delete'] as const;

export async function GET(req: NextRequest) {
  const blocked = await gate(req);
  if (blocked) return blocked;

  const { data, error } = await supabaseAdmin
    .from('role_permissions')
    .select(COLS)
    .order('role', { ascending: true })
    .order('module', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ permissions: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const blocked = await gate(req);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const role = typeof body.role === 'string' ? body.role.trim() : '';
  const module = typeof body.module === 'string' ? body.module.trim() : '';
  if (!role || !module) return NextResponse.json({ error: 'role and module are required' }, { status: 400 });

  const flags: Record<string, boolean> = {};
  for (const k of FLAGS) if (typeof body[k] === 'boolean') flags[k] = body[k] as boolean;
  if (Object.keys(flags).length === 0) return NextResponse.json({ error: 'no permission flags provided' }, { status: 400 });

  // Update the (role, module) cell if it exists, else insert it.
  const { data: existing } = await supabaseAdmin
    .from('role_permissions').select('id').eq('role', role).eq('module', module).maybeSingle();

  const result = existing
    ? await supabaseAdmin.from('role_permissions').update(flags).eq('id', existing.id).select(COLS).single()
    : await supabaseAdmin.from('role_permissions').insert({
        role, module,
        can_view: flags.can_view ?? false,
        can_create: flags.can_create ?? false,
        can_edit: flags.can_edit ?? false,
        can_delete: flags.can_delete ?? false,
      }).select(COLS).single();

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ permission: result.data });
}
