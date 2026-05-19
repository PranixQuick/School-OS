import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/events/galleries/[id] — gallery detail + media items
export async function GET(req: NextRequest, { params }: Params) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id } = await params;

  const [galleryRes, mediaRes] = await Promise.all([
    supabaseAdmin.from('event_galleries').select('*').eq('id', id).eq('school_id', schoolId).single(),
    supabaseAdmin.from('event_media_items').select('id, media_type, file_name, file_size_bytes, storage_path, thumbnail_path, caption, display_order, is_featured, upload_status, view_count, download_count, uploaded_at').eq('gallery_id', id).eq('school_id', schoolId).order('display_order', { ascending: true }),
  ]);

  if (galleryRes.error || !galleryRes.data) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
  return NextResponse.json({ gallery: galleryRes.data, media: mediaRes.data ?? [] });
}

// PATCH /api/admin/events/galleries/[id] — update gallery (publish, archive, edit)
export async function PATCH(req: NextRequest, { params }: Params) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Viewer cannot mutate
  if (ctx.userRole === 'viewer') return NextResponse.json({ error: 'Read-only access' }, { status: 403 });

  const allowed = ['title', 'description', 'event_type', 'event_date', 'audience_type', 'audience_class_filter', 'allow_download', 'expires_at', 'status', 'featured_image_url'];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) { if (body[key] !== undefined) patch[key] = body[key]; }

  const { data, error } = await supabaseAdmin
    .from('event_galleries')
    .update(patch)
    .eq('id', id)
    .eq('school_id', schoolId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Gallery not found' }, { status: 404 });
  return NextResponse.json({ gallery: data });
}

// DELETE /api/admin/events/galleries/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, userRole } = ctx;
  const { id } = await params;

  if (!['owner', 'admin', 'principal'].includes(userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('event_galleries')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
