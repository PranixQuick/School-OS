// app/api/principal/classroom-proofs/route.ts
// Item #6 Principal Dashboard — Loop 4: classroom proofs audit.
//
// GET  /api/principal/classroom-proofs — pending proofs + recently audited
// POST /api/principal/classroom-proofs — verify or flag a proof. Body:
//   { id: uuid, audit_status: 'approved' | 'flagged', audit_notes?: string }
//
// Signed URLs (1h) generated for each pending proof so principal can view photos
// without making the bucket public.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const BUCKET = 'classroom-proofs';
const SIGNED_URL_TTL_SEC = 60 * 60;

interface AuditBody {
  id: string;
  audit_status: 'approved' | 'flagged';
  audit_notes?: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidAuditBody(b: unknown): b is AuditBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    isUuid(o.id) &&
    (o.audit_status === 'approved' || o.audit_status === 'flagged') &&
    (o.audit_notes === undefined || (typeof o.audit_notes === 'string' && o.audit_notes.length <= 1000))
  );
}

async function resolveCtx(req: NextRequest) {
  try { return { ctx: await requirePrincipalSession(req), errResp: null as null }; }
  catch (e) {
    if (e instanceof PrincipalAuthError) return { ctx: null, errResp: NextResponse.json({ error: e.message }, { status: e.status }) };
    throw e;
  }
}

async function hydrate(rows: Array<{ staff_id: string; class_id: string; photo_url: string | null }> | null, schoolId: string) {
  const staffIds = Array.from(new Set((rows ?? []).map((r) => r.staff_id)));
  const classIds = Array.from(new Set((rows ?? []).map((r) => r.class_id)));

  const [staffRes, classRes] = await Promise.all([
    staffIds.length > 0
      ? supabaseAdmin.from('staff').select('id, name').in('id', staffIds).eq('school_id', schoolId)
      : Promise.resolve({ data: [], error: null }),
    classIds.length > 0
      ? supabaseAdmin.from('classes').select('id, grade_level, section').in('id', classIds).eq('school_id', schoolId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const staffMap = Object.fromEntries((staffRes.data ?? []).map((s) => [s.id, s.name]));
  const classMap = Object.fromEntries(
    (classRes.data ?? []).map((c) => [c.id, 'Grade ' + c.grade_level + (c.section ? '-' + c.section : '')])
  );

  // Sign each photo_url
  return Promise.all(
    (rows ?? []).map(async (r) => {
      let signed_url: string | null = null;
      if (r.photo_url) {
        const { data: s } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(r.photo_url, SIGNED_URL_TTL_SEC);
        signed_url = s?.signedUrl ?? null;
      }
      return {
        ...r,
        staff_name: staffMap[r.staff_id] ?? 'Unknown',
        class_label: classMap[r.class_id] ?? '—',
        signed_url,
      };
    })
  );
}

export async function GET(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { schoolId } = ctx!;

  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();

  const pendingRes = await supabaseAdmin
    .from('classroom_proofs')
    .select('id, staff_id, class_id, photo_url, taken_at, audit_status, created_at')
    .eq('school_id', schoolId)
    .eq('audit_status', 'pending')
    .order('taken_at', { ascending: true })
    .limit(50);

  if (pendingRes.error) return NextResponse.json({ error: pendingRes.error.message }, { status: 500 });

  const recentRes = await supabaseAdmin
    .from('classroom_proofs')
    .select('id, staff_id, class_id, photo_url, taken_at, audit_status, audited_at, audit_notes')
    .eq('school_id', schoolId)
    .in('audit_status', ['approved', 'flagged'])
    .gte('audited_at', fourteenDaysAgo)
    .order('audited_at', { ascending: false })
    .limit(30);

  if (recentRes.error) return NextResponse.json({ error: recentRes.error.message }, { status: 500 });

  const [pending, recent_decisions] = await Promise.all([
    hydrate(pendingRes.data, schoolId),
    hydrate(recentRes.data, schoolId),
  ]);

  return NextResponse.json({
    pending,
    recent_decisions,
    pending_count: pending.length,
  });
}

export async function POST(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId: principalStaffId, schoolId } = ctx!;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidAuditBody(body)) {
    return NextResponse.json(
      { error: 'Body must include id (uuid), audit_status ("approved" or "flagged"), optional audit_notes (<=1000 chars)' },
      { status: 400 }
    );
  }

  // Verify the proof exists and is still pending
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from('classroom_proofs')
    .select('id, audit_status')
    .eq('id', body.id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Proof not found' }, { status: 404 });
  if (existing.audit_status !== 'pending') {
    return NextResponse.json(
      { error: 'Proof has already been audited (' + existing.audit_status + ')' },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('classroom_proofs')
    .update({
      audit_status: body.audit_status,
      audited_by: principalStaffId,
      audited_at: new Date().toISOString(),
      audit_notes: body.audit_notes?.trim() ?? null,
    })
    .eq('id', body.id)
    .eq('school_id', schoolId)
    .select('id, audit_status, audited_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proof: data });
}
