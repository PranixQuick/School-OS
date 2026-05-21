// app/api/meo/action-items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status') ?? 'open';
  const { data, error } = await supabaseAdmin.from('meo_action_items')
    .select('id, school_id, category, description, severity, due_date, status, created_at')
    .in('status', status === 'all' ? ['open','in_progress','resolved','verified_closed'] : [status])
    .order('severity', { ascending: false })
    .order('due_date', { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const schoolIds = [...new Set((data ?? []).map(r => r.school_id))];
  const { data: schools } = await supabaseAdmin.from('schools').select('id, name').in('id', schoolIds);
  const schoolMap = Object.fromEntries((schools ?? []).map(s => [s.id, s.name]));
  const enriched = (data ?? []).map(r => ({ ...r, school_name: schoolMap[r.school_id] ?? 'Unknown' }));
  return NextResponse.json({ items: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { school_id?: string; inspection_id?: string; category?: string; description?: string; severity?: string; due_date?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.school_id || !body?.description) return NextResponse.json({ error: 'school_id and description required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('meo_action_items').insert({
    school_id: body.school_id,
    inspection_id: body.inspection_id ?? null,
    category: body.category ?? 'compliance',
    description: body.description,
    severity: body.severity ?? 'medium',
    due_date: body.due_date ?? null,
    status: 'open',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { id?: string; status?: string; closure_notes?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('meo_action_items').update({
    status:        body.status ?? 'resolved',
    resolved_at:   new Date().toISOString(),
    resolved_by:   session.userId,
    closure_notes: body.closure_notes ?? null,
  }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
