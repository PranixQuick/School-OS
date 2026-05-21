// app/api/admin/internships/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status');
  let q = supabaseAdmin.from('internship_records')
    .select('id, company_name, role, location, start_date, end_date, status, stipend_amount, completion_cert_url, grade, student:student_id(name, class)')
    .eq('school_id', session.schoolId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ internships: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { student_id?: string; company_name?: string; role?: string; location?: string; start_date?: string; end_date?: string; stipend_amount?: number; mentor_name?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.student_id || !body?.company_name) return NextResponse.json({ error: 'student_id and company_name required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('internship_records').insert({
    school_id:      session.schoolId,
    student_id:     body.student_id,
    company_name:   body.company_name,
    role:           body.role ?? null,
    location:       body.location ?? null,
    start_date:     body.start_date ?? null,
    end_date:       body.end_date ?? null,
    stipend_amount: body.stipend_amount ?? 0,
    mentor_name:    body.mentor_name ?? null,
    status:         'ongoing',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, internship: data });
}
