// app/api/admin/safety-compliance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('safety_compliance_log')
    .select('*').eq('school_id', session.schoolId)
    .order('event_date', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { compliance_type?: string; event_date?: string; outcome?: string; participants_count?: number | null; notes?: string; next_due_date?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.compliance_type || !body?.event_date) return NextResponse.json({ error: 'compliance_type and event_date required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('safety_compliance_log').insert({
    school_id: session.schoolId,
    compliance_type: body.compliance_type,
    event_date: body.event_date,
    conducted_by: session.userId,
    outcome: body.outcome ?? 'pass',
    participants_count: body.participants_count ?? null,
    notes: body.notes ?? null,
    next_due_date: body.next_due_date || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, record: data });
}
