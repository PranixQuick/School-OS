import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// GET — list galleries for this school
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { data, error } = await supabaseAdmin
    .from('event_galleries')
    .select('id, title, description, event_type, event_date, status, photo_count, video_count, featured_image_url, allow_download, audience_type, created_at')
    .eq('school_id', ctx.schoolId)
    .order('event_date', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ galleries: data ?? [] });
}

// POST — create a new gallery
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, description, event_type, event_date, allow_download, audience_type } = body as Record<string, unknown>;
  if (!title || !event_date) {
    return NextResponse.json({ error: 'title and event_date required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('event_galleries')
    .insert({
      school_id: ctx.schoolId,
      title: title as string,
      description: (description as string) ?? null,
      event_type: (event_type as string) ?? 'general',
      event_date: event_date as string,
      status: 'draft',
      allow_download: Boolean(allow_download),
      audience_type: (audience_type as string) ?? 'all_parents',
      created_by: ctx.userId,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gallery: data }, { status: 201 });
}
