// app/api/teacher/proofs/route.ts
// Item #1 Track C Phase 4 — classroom proofs.
//
// GET  /api/teacher/proofs — list this teacher's recent proofs (last 30 days)
//                              with signed photo URLs (1h expiry)
// POST /api/teacher/proofs — request a signed upload URL for a new proof.
//                              Client uploads directly to storage with the URL,
//                              then POSTs the photo path back via PUT.
// PUT  /api/teacher/proofs — finalize: insert classroom_proofs row pointing
//                              at the uploaded photo path.
//
// Defense-in-depth: every query .eq('staff_id', ctx.staffId).eq('school_id', ctx.schoolId).
// Storage path convention: <school_id>/<staff_id>/<uuid>.jpg — RLS storage policies
// (if installed elsewhere) gate by path prefix.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const BUCKET = 'classroom-proofs';
const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

async function resolveCtx(req: NextRequest) {
  try { return { ctx: await requireTeacherSession(req), errResp: null as null }; }
  catch (e) {
    if (e instanceof TeacherAuthError) return { ctx: null, errResp: NextResponse.json({ error: e.message }, { status: e.status }) };
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId } = ctx!;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('classroom_proofs')
    .select('id, class_id, taken_at, photo_url, audit_status, audit_notes, created_at')
    .eq('staff_id', staffId)
    .eq('school_id', schoolId)
    .gte('taken_at', thirtyDaysAgo)
    .order('taken_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sign each photo_url (paths in the bucket — not full URLs)
  const proofs = await Promise.all(
    (data ?? []).map(async (p) => {
      if (!p.photo_url) return { ...p, signed_url: null };
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(p.photo_url, SIGNED_URL_TTL_SEC);
      return { ...p, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ proofs });
}

// POST: request a signed upload URL. Client uploads directly to storage,
// then calls PUT below to finalize.
export async function POST(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId } = ctx!;

  // Generate path: <school_id>/<staff_id>/<random>.jpg
  const random = crypto.randomUUID();
  const path = schoolId + '/' + staffId + '/' + random + '.jpg';

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    upload_url: data.signedUrl,
    photo_path: path,
    token: data.token,
  });
}

interface FinalizeBody {
  photo_path: string;
  class_id: string;
  geo_lat?: number;
  geo_lng?: number;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidFinalize(b: unknown): b is FinalizeBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return typeof o.photo_path === 'string' && o.photo_path.length > 0 &&
    isUuid(o.class_id) &&
    (o.geo_lat === undefined || typeof o.geo_lat === 'number') &&
    (o.geo_lng === undefined || typeof o.geo_lng === 'number');
}

// PUT: finalize. Inserts classroom_proofs row pointing at the uploaded photo.
export async function PUT(req: NextRequest) {
  const { ctx, errResp } = await resolveCtx(req);
  if (errResp) return errResp;
  const { staffId, schoolId, session } = ctx!;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!isValidFinalize(body)) {
    return NextResponse.json({ error: 'Body must include photo_path (string), class_id (uuid), optional geo_lat/geo_lng (numbers)' }, { status: 400 });
  }

  // Defense: photo_path must live under this teacher's scope prefix
  const expectedPrefix = schoolId + '/' + staffId + '/';
  if (!body.photo_path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'photo_path does not match teacher scope' }, { status: 403 });
  }

  // Verify teacher teaches this class
  const { data: ttRow } = await supabaseAdmin
    .from('timetable')
    .select('id')
    .eq('staff_id', staffId).eq('school_id', schoolId).eq('class_id', body.class_id)
    .limit(1).maybeSingle();
  if (!ttRow) return NextResponse.json({ error: 'You are not scheduled to teach this class' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('classroom_proofs')
    .insert({
      school_id: schoolId,
      class_id: body.class_id,
      staff_id: staffId,
      uploaded_by: session.userId,
      photo_url: body.photo_path,
      taken_at: new Date().toISOString(),
      geo_lat: body.geo_lat ?? null,
      geo_lng: body.geo_lng ?? null,
      audit_status: 'pending',
    })
    .select('id, taken_at, audit_status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ proof: data }, { status: 201 });
}
