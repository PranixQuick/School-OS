// app/api/admin/infrastructure/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('school_infrastructure_log')
    .select('*').eq('school_id', session.schoolId)
    .order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { category?: string; condition_rating?: string; item_count?: number; notes?: string; inspection_date?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.category) return NextResponse.json({ error: 'category required' }, { status: 400 });
  const { data: inst } = await supabaseAdmin.from('institutions').select('settings').eq('legacy_school_id', session.schoolId).single();
  const isGovt = inst?.settings?.school_mode === 'govt_high_school' || inst?.settings?.school_mode === 'govt_primary';
  const flagMEO = isGovt && ['poor','non_functional'].includes(body.condition_rating ?? '');
  const { data, error } = await supabaseAdmin.from('school_infrastructure_log').insert({
    school_id: session.schoolId,
    category: body.category,
    condition_rating: body.condition_rating ?? 'fair',
    item_count: body.item_count ?? 1,
    notes: body.notes ?? null,
    inspection_date: body.inspection_date ?? new Date().toISOString().split('T')[0],
    flagged_to_meo: flagMEO,
    recorded_by: session.userId,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data, flagged_to_meo: flagMEO });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { id?: string; resolved?: boolean } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('school_infrastructure_log')
    .update({ resolved_at: body.resolved ? new Date().toISOString() : null })
    .eq('id', body.id).eq('school_id', session.schoolId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
