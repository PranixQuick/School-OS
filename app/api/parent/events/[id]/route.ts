import { NextRequest, NextResponse } from 'next/server';
import { getParentSession } from '@/lib/parent-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/parent/events/[id] — gallery detail + media for parent
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify gallery is published and accessible to parents (tenant-safe)
  const { data: gallery, error: gErr } = await supabaseAdmin
    .from('event_galleries')
    .select('id, title, description, event_type, event_date, status, photo_count, video_count, featured_image_url, allow_download, audience_type')
    .eq('id', id)
    .eq('school_id', session.schoolId)
    .eq('status', 'published')
    .single();

  if (gErr || !gallery) {
    return NextResponse.json({ error: 'Gallery not found or not published' }, { status: 404 });
  }

  // Get media items
  const { data: mediaItems } = await supabaseAdmin
    .from('event_media_items')
    .select('id, media_type, file_name, storage_path, caption, is_featured, upload_status, view_count')
    .eq('gallery_id', id)
    .eq('school_id', session.schoolId)
    .eq('upload_status', 'ready')
    .order('display_order', { ascending: true })
    .order('uploaded_at', { ascending: true });

  // Log view
  await supabaseAdmin.from('event_media_views').insert({
    gallery_id: id,
    school_id: session.schoolId,
    viewer_type: 'parent',
    viewer_id: session.studentId,
  }).then(() => {}).catch(() => {});

  return NextResponse.json({ gallery, media: mediaItems ?? [] });
}
