// app/api/trades/route.ts
// Bible Phase 8 Step 8.2: CRUD for ITI trade definitions + enrollments.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  const tradeId = req.nextUrl.searchParams.get('trade_id');

  if (tradeId) {
    // Get trade with its enrollments
    const [tradeRes, enrollRes] = await Promise.all([
      supabaseAdmin.from('trades').select('*').eq('id', tradeId).maybeSingle(),
      supabaseAdmin.from('trade_enrollments')
        .select('*, students:student_id(name, class, section)')
        .eq('trade_id', tradeId)
        .order('created_at', { ascending: false }),
    ]);

    if (tradeRes.error || !tradeRes.data) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    return NextResponse.json({
      trade: tradeRes.data,
      enrollments: enrollRes.data ?? [],
    });
  }

  // List all trades for the institution
  // Resolve institution_id from school
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('institution_id')
    .eq('id', session.schoolId)
    .maybeSingle();

  if (!school?.institution_id) {
    return NextResponse.json({ trades: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('trades')
    .select('*')
    .eq('institution_id', school.institution_id)
    .eq('is_active', true)
    .order('trade_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ trades: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  if (!['admin', 'principal', 'super_admin'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }

  const body = await req.json() as {
    action?: 'create_trade' | 'enroll_student';
    // For create_trade
    trade_name?: string;
    trade_code?: string;
    duration_months?: number;
    certification_body?: string;
    max_intake?: number;
    // For enroll_student
    student_id?: string;
    trade_id?: string;
    batch_start?: string;
    expected_completion?: string;
  };

  const action = body.action ?? 'create_trade';

  if (action === 'enroll_student') {
    if (!body.student_id || !body.trade_id) {
      return NextResponse.json({ error: 'student_id and trade_id required' }, { status: 400 });
    }

    // Verify student belongs to school
    const { data: student } = await supabaseAdmin
      .from('students').select('id').eq('id', body.student_id).eq('school_id', session.schoolId).maybeSingle();
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from('trade_enrollments')
      .insert({
        student_id: body.student_id,
        trade_id: body.trade_id,
        batch_start: body.batch_start ?? null,
        expected_completion: body.expected_completion ?? null,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, enrollment_id: data.id }, { status: 201 });
  }

  // create_trade
  if (!body.trade_name) {
    return NextResponse.json({ error: 'trade_name required' }, { status: 400 });
  }

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', session.schoolId).maybeSingle();

  if (!school?.institution_id) {
    return NextResponse.json({ error: 'No institution linked to this school' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('trades')
    .insert({
      institution_id: school.institution_id,
      trade_name: body.trade_name,
      trade_code: body.trade_code ?? null,
      duration_months: body.duration_months ?? null,
      certification_body: body.certification_body ?? 'NCVT',
      max_intake: body.max_intake ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, trade_id: data.id }, { status: 201 });
}
