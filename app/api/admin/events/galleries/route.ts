import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// GET /api/admin/events/galleries — list all galleries for school
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const status = req.nextUrl.searchParams.get('status') ?? 'published';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20'), 50);

  let q = supabaseAdmin
    .from('event_galleries')
    .select('id, title, description, event_type, event_date, status, audience_type, photo_count, video_count, featured_image_url, allow_download, created_at, expires_at')
    .eq('school_id', schoolId)
    .order('event_date', { ascending: false })
    .limit(limit);

  if (status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ galleries: data ?? [] });
}

// POST /api/admin/events/galleries — create gallery
export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, userId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, description, event_type, event_date, audience_type, audience_class_filter, allow_download, expires_at } = body as {
    title?: string; description?: string; event_type?: string; event_date?: string;
    audience_type?: string; audience_class_filter?: unknown; allow_download?: boolean; expires_at?: string;
  };

  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('event_galleries')
    .insert({
      school_id: schoolId,
      title: title.trim(),
      description: description ?? null,
      event_type: event_type ?? 'general',
      event_date: event_date ?? new Date().toISOString().slice(0, 10),
      audience_type: audience_type ?? 'all_parents',
      audience_class_filter: audience_class_filter ?? null,
      allow_download: allow_download !== false,
      expires_at: expires_at ?? null,
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gallery: data }, { status: 201 });
}
