// app/api/anganwadi/immunization/route.ts
// Anganwadi immunization records API.
// GET  ?student_id=X  → return all records for that student
// POST { student_id, vaccine_name, administered_date, status, dose_number }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const studentId = req.nextUrl.searchParams.get('student_id');
  const query = supabaseAdmin
    .from('immunization_records')
    .select('id, vaccine_name, scheduled_date, administered_date, dose_number, status, notes')
    .eq('school_id', session.schoolId)
    .order('scheduled_date', { ascending: true });

  if (studentId) query.eq('student_id', studentId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    student_id?: string; vaccine_name?: string;
    administered_date?: string; status?: string; dose_number?: number; notes?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });
  if (!body.vaccine_name) return NextResponse.json({ error: 'vaccine_name required' }, { status: 400 });

  // Verify student belongs to this school
  const { data: student } = await supabaseAdmin
    .from('students').select('id').eq('id', body.student_id).eq('school_id', session.schoolId).maybeSingle();
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const { data: record, error } = await supabaseAdmin
    .from('immunization_records')
    .upsert({
      school_id:         session.schoolId,
      student_id:        body.student_id,
      vaccine_name:      body.vaccine_name,
      administered_date: body.administered_date ?? null,
      status:            body.status ?? 'administered',
      dose_number:       body.dose_number ?? 1,
      notes:             body.notes ?? null,
    }, { onConflict: 'school_id,student_id,vaccine_name,dose_number' })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, record_id: record?.id });
}
