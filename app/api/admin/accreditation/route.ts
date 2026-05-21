// app/api/admin/accreditation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('accreditation_records')
    .select('*').eq('school_id', session.schoolId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner','principal'].includes(session.userRole)) return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  let body: { body?: string; current_grade?: string; valid_from?: string; valid_until?: string; last_visit_date?: string; next_visit_date?: string; status?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.body) return NextResponse.json({ error: 'body (accreditation body name) required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('accreditation_records').insert({
    school_id: session.schoolId,
    body: body.body,
    current_grade: body.current_grade ?? null,
    valid_from: body.valid_from || null,
    valid_until: body.valid_until || null,
    last_visit_date: body.last_visit_date || null,
    next_visit_date: body.next_visit_date || null,
    status: body.status ?? 'active',
    coordinator_id: session.userId,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, record: data });
}
