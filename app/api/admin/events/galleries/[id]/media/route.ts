import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// POST /api/admin/events/galleries/[id]/media
// Body: { file_name, mime_type, file_size_bytes, caption?, media_type? }
// Returns: { media_item, upload_url } — upload_url is a signed URL to PUT the file directly
export async function POST(req: NextRequest, { params }: Params) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, userId } = ctx;
  const { id: galleryId } = await params;

  if (ctx.userRole === 'viewer') return NextResponse.json({ error: 'Read-only access' }, { status: 403 });

  // Verify gallery belongs to school
  const { data: gallery } = await supabaseAdmin
    .from('event_galleries').select('id, status').eq('id', galleryId).eq('school_id', schoolId).single();
  if (!gallery) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { file_name, mime_type, file_size_bytes, caption, media_type } = body as {
    file_name?: string; mime_type?: string; file_size_bytes?: number; caption?: string; media_type?: string;
  };

  if (!file_name) return NextResponse.json({ error: 'file_name required' }, { status: 400 });

  // Determine media type from mime
  const resolvedType = media_type ?? (mime_type?.startsWith('video/') ? 'video' : 'photo');

  // Storage path: event-media/{school_id}/{gallery_id}/{timestamp}_{file_name}
  const timestamp = Date.now();
  const safeFileName = file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storagePath = `${schoolId}/${galleryId}/${timestamp}_${safeFileName}`;

  // Register media item first (status: pending)
  const { data: mediaItem, error: insertErr } = await supabaseAdmin
    .from('event_media_items')
    .insert({
      school_id: schoolId,
      gallery_id: galleryId,
      media_type: resolvedType,
      file_name: file_name,
      file_size_bytes: file_size_bytes ?? null,
      mime_type: mime_type ?? null,
      storage_path: storagePath,
      caption: caption ?? null,
      upload_status: 'pending',
      uploaded_by: userId,
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Generate signed upload URL (60 minutes expiry)
  const storageClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: signedData, error: signErr } = await storageClient.storage
    .from('event-media')
    .createSignedUploadUrl(storagePath);

  if (signErr) {
    // Clean up the pending record
    await supabaseAdmin.from('event_media_items').delete().eq('id', mediaItem.id);
    return NextResponse.json({ error: `Storage error: ${signErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    media_item: mediaItem,
    upload_url: signedData.signedUrl,
    storage_path: storagePath,
  }, { status: 201 });
}

// PATCH /api/admin/events/galleries/[id]/media — mark upload complete
// Body: { media_item_id, status: 'ready' | 'failed', public_url? }
export async function PATCH(req: NextRequest, { params }: Params) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id: galleryId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { media_item_id, status, public_url } = body as { media_item_id?: string; status?: string; public_url?: string; };
  if (!media_item_id || !status) return NextResponse.json({ error: 'media_item_id and status required' }, { status: 400 });

  const patch: Record<string, unknown> = { upload_status: status };
  if (public_url) patch.storage_path = public_url;

  const { data, error } = await supabaseAdmin
    .from('event_media_items')
    .update(patch)
    .eq('id', media_item_id)
    .eq('gallery_id', galleryId)
    .eq('school_id', schoolId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ media_item: data });
}
