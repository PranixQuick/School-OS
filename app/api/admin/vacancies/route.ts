// app/api/admin/vacancies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status') ?? 'open';
  let q = supabaseAdmin.from('teacher_vacancies').select('*').eq('school_id', session.schoolId).order('vacant_since', { ascending: true });
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ vacancies: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { subject?: string; class_level?: string; position_type?: string; vacant_since?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.subject) return NextResponse.json({ error: 'subject required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('teacher_vacancies').insert({ school_id: session.schoolId, ...body, status: 'open' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vacancy: data });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { id?: string; status?: string; reported_to_meo?: boolean } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.reported_to_meo !== undefined) { updates.reported_to_meo = body.reported_to_meo; updates.reported_at = new Date().toISOString(); }
  const { error } = await supabaseAdmin.from('teacher_vacancies').update(updates).eq('id', body.id).eq('school_id', session.schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
