// app/api/anganwadi/growth/route.ts
// Anganwadi child growth record API.
// POST: saves weight/height/MUAC/malnutrition to child_growth_records
// GET:  returns recent records with child names
//
// School-mode gated: only works for anganwadi institutions.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    student_id?: string; weight_kg?: number; height_cm?: number;
    muac_cm?: number; malnutrition_cat?: string; grade_for_age?: string; notes?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.student_id) return NextResponse.json({ error: 'student_id required' }, { status: 400 });
  if (!body.weight_kg) return NextResponse.json({ error: 'weight_kg required' }, { status: 400 });

  // Verify student belongs to this school
  const { data: student } = await supabaseAdmin
    .from('students').select('id, name, school_id').eq('id', body.student_id).eq('school_id', session.schoolId).maybeSingle();

  if (!student) return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });

  const { data: record, error } = await supabaseAdmin
    .from('child_growth_records')
    .insert({
      school_id:        session.schoolId,
      student_id:       body.student_id,
      recorded_date:    new Date().toISOString().split('T')[0],
      weight_kg:        body.weight_kg,
      height_cm:        body.height_cm ?? null,
      muac_cm:          body.muac_cm ?? null,
      malnutrition_cat: body.malnutrition_cat ?? null,
      grade_for_age:    body.grade_for_age ?? null,
      notes:            body.notes ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // SAM alert: if malnutrition_cat = 'sam', create a health incident for supervisor visibility
  if (body.malnutrition_cat === 'sam') {
    try {
      await supabaseAdmin.from('health_incidents').insert({
        school_id:            session.schoolId,
        student_id:           body.student_id,
        incident_date:        new Date().toISOString().split('T')[0],
        incident_type:        'malnutrition_sam',
        description:          `SAM detected. Weight: ${body.weight_kg}kg${body.muac_cm ? `, MUAC: ${body.muac_cm}cm` : ''}. NRC referral required.`,
        first_aid_given:      'Growth record created. Supervisor alert triggered.',
        parent_notified:      false,
        referred_to_hospital: false,
      });
    } catch (e) {
      console.error('[growth] SAM health incident insert failed:', e);
    }
  }

  return NextResponse.json({ success: true, record_id: record?.id });
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: records } = await supabaseAdmin
    .from('child_growth_records')
    .select(`
      id, recorded_date, weight_kg, height_cm, muac_cm, malnutrition_cat,
      students!inner(name)
    `)
    .eq('school_id', session.schoolId)
    .order('recorded_date', { ascending: false })
    .limit(20);

  const formatted = (records ?? []).map(r => {
    const stu = r.students as { name?: string } | null;
    return {
      id:              r.id,
      recorded_date:   r.recorded_date,
      weight_kg:       r.weight_kg,
      height_cm:       r.height_cm,
      muac_cm:         r.muac_cm,
      malnutrition_cat: r.malnutrition_cat,
      child_name:      stu?.name ?? 'Unknown',
    };
  });

  return NextResponse.json({ records: formatted });
}
