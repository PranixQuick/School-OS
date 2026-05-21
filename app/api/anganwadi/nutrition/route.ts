// app/api/anganwadi/nutrition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0];
  const { data, error } = await supabaseAdmin
    .from('nutrition_supplement_log')
    .select('id, supplement_type, quantity, unit, distribution_date, student:student_id(name)')
    .eq('school_id', session.schoolId)
    .eq('distribution_date', date)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { supplement_type?: string; quantity?: number; unit?: string; distribution_date?: string; student_ids?: string[] } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.supplement_type || !body?.student_ids?.length) return NextResponse.json({ error: 'supplement_type and student_ids required' }, { status: 400 });
  const rows = body.student_ids.map(sid => ({
    school_id: session.schoolId,
    student_id: sid,
    supplement_type: body!.supplement_type!,
    quantity: body!.quantity ?? 1,
    unit: body!.unit ?? 'units',
    distribution_date: body!.distribution_date ?? new Date().toISOString().split('T')[0],
    distributed_by: session.userId,
  }));
  const { error } = await supabaseAdmin.from('nutrition_supplement_log').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: rows.length });
}
