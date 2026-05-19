import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

// GET — gallery detail + media
export async function GET(req: NextRequest, { params }: Params) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { id } = await params;
  const { data: gallery } = await supabaseAdmin
    .from('event_galleries')
    .select('*')
    .eq('id', id).eq('school_id', ctx.schoolId).single();

  if (!gallery) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: media } = await supabaseAdmin
    .from('event_media_items')
    .select('id, media_type, file_name, storage_path, caption, is_featured, upload_status, view_count, download_count, uploaded_at, display_order')
    .eq('gallery_id', id).eq('school_id', ctx.schoolId)
    .order('display_order', { ascending: true })
    .order('uploaded_at', { ascending: true });

  return NextResponse.json({ gallery, media: media ?? [] });
}

// PATCH — update gallery (status, title, description, allow_download)
export async function PATCH(req: NextRequest, { params }: Params) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from('event_galleries').select('id, status, title, school_id')
    .eq('id', id).eq('school_id', ctx.schoolId).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.title) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.allow_download !== undefined) patch.allow_download = body.allow_download;
  if (body.featured_image_url !== undefined) patch.featured_image_url = body.featured_image_url;

  const { data: updated, error } = await supabaseAdmin
    .from('event_galleries').update(patch).eq('id', id).eq('school_id', ctx.schoolId).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // WhatsApp notify on publish
  if (body.status === 'published' && existing.status !== 'published') {
    void sendWhatsAppGalleryNotification(ctx.schoolId, existing.title as string, id);
  }

  return NextResponse.json({ gallery: updated });
}

// DELETE
export async function DELETE(req: NextRequest, { params }: Params) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { id } = await params;
  await supabaseAdmin.from('event_galleries').delete().eq('id', id).eq('school_id', ctx.schoolId);
  return NextResponse.json({ success: true });
}

// Helper: send WhatsApp to all active parent numbers for this school
async function sendWhatsAppGalleryNotification(schoolId: string, galleryTitle: string, galleryId: string) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!accountSid || !authToken || !from) return;

    // Get up to 50 active parent phone numbers for this school
    const { data: parents } = await supabaseAdmin
      .from('parents')
      .select('phone_number')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(50);

    if (!parents || parents.length === 0) return;

    const twilio = (await import('twilio')).default;
    const client = twilio(accountSid, authToken);
    const message = `📸 New event gallery published: *${galleryTitle}*\n\nView photos in the EdProSys parent app.`;

    for (const parent of parents) {
      if (!parent.phone_number) continue;
      await client.messages.create({
        from,
        to: `whatsapp:${parent.phone_number}`,
        body: message,
      }).catch(() => {}); // Swallow per-number errors
    }
  } catch { /* silent — notification failure must not break gallery publish */ }
}
