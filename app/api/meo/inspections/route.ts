// app/api/meo/inspections/route.ts
// MEO school inspection CRUD — government schools only
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['meo','admin','owner','principal'].includes(session.userRole)) return NextResponse.json({ error: 'MEO role required' }, { status: 403 });
  const { data, error } = await supabaseAdmin.from('meo_inspection_reports')
    .select('id, school_id, visit_date, overall_rating, compliance_score, follow_up_required, report_status, created_at')
    .order('visit_date', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Enrich with school names
  const schoolIds = [...new Set((data ?? []).map(r => r.school_id))];
  const { data: schools } = await supabaseAdmin.from('schools').select('id, name').in('id', schoolIds);
  const schoolMap = Object.fromEntries((schools ?? []).map(s => [s.id, s.name]));
  const enriched = (data ?? []).map(r => ({ ...r, school_name: schoolMap[r.school_id] ?? 'Unknown' }));
  return NextResponse.json({ inspections: enriched });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['meo','admin','owner'].includes(session.userRole)) return NextResponse.json({ error: 'MEO role required' }, { status: 403 });
  let body: { school_id?: string; visit_date?: string; overall_rating?: string; compliance_score?: number; observations?: string; follow_up_required?: boolean } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body?.school_id || !body?.visit_date) return NextResponse.json({ error: 'school_id and visit_date required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('meo_inspection_reports').insert({
    school_id:         body.school_id,
    meo_user_id:       session.userId,
    visit_date:        body.visit_date,
    overall_rating:    body.overall_rating ?? 'satisfactory',
    compliance_score:  body.compliance_score ?? 80,
    observations:      body.observations ? [body.observations] : [],
    follow_up_required:body.follow_up_required ?? false,
    report_status:     'submitted',
    submitted_at:      new Date().toISOString(),
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the inspected school in real time. Best-effort.
  try {
    const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
      school_id: body.school_id,
      type: 'alert',
      title: 'MEO inspection report filed',
      message: `An MEO inspection (${body.overall_rating ?? 'satisfactory'}, compliance ${body.compliance_score ?? 80}%) was recorded for your school on ${body.visit_date}.`,
      module: 'meo_inspection',
      reference_id: data.id,
      channel: 'email',
      status: 'pending',
    });
    if (notifErr) console.error('MEO inspection notification failed (non-fatal):', notifErr);
  } catch (e) {
    console.error('MEO inspection notification threw (non-fatal):', e);
  }

  return NextResponse.json({ success: true, inspection: data });
}
