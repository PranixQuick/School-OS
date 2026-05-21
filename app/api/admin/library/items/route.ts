// app/api/admin/library/items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const search = req.nextUrl.searchParams.get('q');
  let q = supabaseAdmin.from('library_items').select('*').eq('school_id', session.schoolId).eq('is_active', true).order('title');
  if (search) q = q.ilike('title', `%${search}%`);
  const { data, error } = await q.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner'].includes(session.userRole)) return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  let body: { title?: string; author?: string; subject?: string; total_copies?: number; accession_number?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('library_items').insert({
    school_id: session.schoolId,
    title: body.title,
    author: body.author ?? '',
    subject: body.subject ?? '',
    total_copies: body.total_copies ?? 1,
    available_copies: body.total_copies ?? 1,
    accession_number: body.accession_number ?? '',
    is_active: true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}
