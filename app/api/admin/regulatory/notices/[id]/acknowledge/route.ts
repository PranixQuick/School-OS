// app/api/admin/regulatory/notices/[id]/acknowledge/route.ts
// Batch 5A — Mark a regulatory notice as acknowledged by this institution.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;
  const { id: noticeId } = await params;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'No institution' }, { status: 400 });
  const institutionId = school.institution_id;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('institution_notice_deliveries')
    .upsert({
      institution_id: institutionId,
      notice_id: noticeId,
      delivered_to_roles: ['admin','principal'],
      acknowledged_by: staffId ?? null,
      acknowledged_at: now,
      delivered_at: now,
    }, { onConflict: 'institution_id,notice_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ acknowledged: true });
}
