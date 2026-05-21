// app/api/admin/assessments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('assessments')
    .select('id, type, scheduled_date, max_marks, weightage, status, created_at')
    .eq('school_id', session.schoolId)
    .order('scheduled_date', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assessments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin','owner','principal'].includes(session.userRole)) return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  let body: { type?: string; scheduled_date?: string; max_marks?: number; weightage?: number } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.type || !body?.scheduled_date) return NextResponse.json({ error: 'type and scheduled_date required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('assessments').insert({
    school_id: session.schoolId,
    type: body.type,
    scheduled_date: body.scheduled_date,
    max_marks: body.max_marks ?? 100,
    weightage: body.weightage ?? null,
    status: 'scheduled',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, assessment: data });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { id?: string; status?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('assessments').update({ status: body.status }).eq('id', body.id).eq('school_id', session.schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
