// app/api/anganwadi/beneficiaries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('anganwadi_beneficiaries')
    .select('id, name, phone, age_years, beneficiary_type, trimester, edd_date, nutrition_status, next_checkup_date, husband_name, status')
    .eq('school_id', session.schoolId)
    .eq('is_active', true)
    .order('next_checkup_date', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ beneficiaries: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!body.beneficiary_type) return NextResponse.json({ error: 'beneficiary_type required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('anganwadi_beneficiaries')
    .insert({
      school_id:         session.schoolId,
      name:              body.name as string,
      phone:             (body.phone as string) ?? null,
      age_years:         body.age_years ? Number(body.age_years) : null,
      beneficiary_type:  body.beneficiary_type as string,
      trimester:         body.trimester ? Number(body.trimester) : null,
      husband_name:      (body.husband_name as string) ?? null,
      address:           (body.address as string) ?? null,
      registration_date: new Date().toISOString().split('T')[0],
      status:            'active',
      nutrition_status:  (body.nutrition_status as string) ?? 'normal',
      next_checkup_date: (body.next_checkup_date as string) ?? null,
      is_active:         true,
      language_pref:     'te',
    })
    .select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
}
