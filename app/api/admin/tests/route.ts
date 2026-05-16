import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// K3: Coaching test management — create and list tests
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const body = await req.json() as { title: string; test_date: string; max_marks?: number; subject?: string; batch_id?: string };
  if (!body.title || !body.test_date) return NextResponse.json({ error: 'title and test_date required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('tests').insert({
    school_id: schoolId,
    title: body.title,
    test_date: body.test_date,
    max_marks: body.max_marks ?? 100,
    subject: body.subject ?? null,
    batch_id: body.batch_id ?? null,
  }).select('id, title, test_date, max_marks, subject').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ test: data });
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { data, error } = await supabaseAdmin.from('tests')
    .select('id, title, test_date, max_marks, subject, batch_id, created_at')
    .eq('school_id', schoolId)
    .order('test_date', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tests: data ?? [] });
}
