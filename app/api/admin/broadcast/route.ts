// app/api/admin/broadcast/route.ts
// Item #14 PR #2 — Admin/Principal broadcast notification trigger.
//
// POST /api/admin/broadcast
//   Auth: requireAdminSession OR requirePrincipalSession
//   Body: { subject: string, message: string }
//
// Inserts a broadcast notification row; dispatcher delivers to all active parents.
// Returns: { success: true, notification_id }

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { writeNotification } from '@/lib/notifications';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

interface BroadcastBody {
  subject: string;
  message: string;
}

function isValidBody(b: unknown): b is BroadcastBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.subject === 'string' && o.subject.trim().length > 0 && o.subject.length <= 200 &&
    typeof o.message === 'string' && o.message.trim().length > 0 && o.message.length <= 4000
  );
}

export async function POST(req: NextRequest) {
  // Accept admin OR principal session
  let schoolId: string;
  try {
    const ctx = await requireAdminSession(req);
    schoolId = ctx.schoolId;
  } catch (adminErr) {
    if (!(adminErr instanceof AdminAuthError)) throw adminErr;
    // Try principal session as fallback
    try {
      const ctx = await requirePrincipalSession(req);
      schoolId = ctx.schoolId;
    } catch (principalErr) {
      if (principalErr instanceof PrincipalAuthError) {
        return NextResponse.json({ error: 'Authentication required (admin or principal)' }, { status: 401 });
      }
      throw principalErr;
    }
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Body must include subject (≤200 chars) and message (≤4000 chars), both non-empty' },
      { status: 400 }
    );
  }

  // Count active parents for target_count
  const { count: parentCount } = await supabaseAdmin
    .from('parents')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId);

  const result = await writeNotification(supabaseAdmin, {
    school_id: schoolId,
    type: 'broadcast',
    title: body.subject.trim(),
    message: body.message.trim(),
    module: 'announcement',
  });

  if (!result.ok) {
    console.error('[admin/broadcast] notification write failed:', result.error);
    return NextResponse.json({ error: result.error ?? 'Failed to create broadcast' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    notification_id: result.id,
    target_count: parentCount ?? 0,
  });
}
