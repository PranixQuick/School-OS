// app/api/milestones/route.ts
// Bible Phase 8 Step 8.1: CRUD for developmental milestones
// Used by playschool, KG, and anganwadi institutions.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

const VALID_CATEGORIES = ['motor', 'social', 'language', 'cognitive', 'emotional'] as const;

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  const studentId = req.nextUrl.searchParams.get('student_id');
  const category = req.nextUrl.searchParams.get('category');

  let query = supabaseAdmin
    .from('developmental_milestones')
    .select('*, staff:observed_by(name)')
    .eq('school_id', session.schoolId)
    .order('created_at', { ascending: false });

  if (studentId) query = query.eq('student_id', studentId);
  if (category && VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    query = query.eq('category', category);
  }

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ milestones: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  if (!['admin', 'teacher', 'principal'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }

  const body = await req.json() as {
    student_id: string;
    category: string;
    milestone_name: string;
    expected_age_months?: number;
    achieved_at?: string;
    notes?: string;
  };

  if (!body.student_id || !body.category || !body.milestone_name) {
    return NextResponse.json({ error: 'student_id, category, and milestone_name required' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(body.category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
  }

  // Verify student belongs to this school
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('id', body.student_id)
    .eq('school_id', session.schoolId)
    .maybeSingle();

  if (!student) return NextResponse.json({ error: 'Student not found in your school' }, { status: 404 });

  // Get staff_id for observed_by
  const { data: schoolUser } = await supabaseAdmin
    .from('school_users')
    .select('staff_id')
    .eq('id', session.userId)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from('developmental_milestones')
    .insert({
      school_id: session.schoolId,
      student_id: body.student_id,
      category: body.category,
      milestone_name: body.milestone_name,
      expected_age_months: body.expected_age_months ?? null,
      achieved_at: body.achieved_at ?? null,
      observed_by: schoolUser?.staff_id ?? null,
      notes: body.notes ?? null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}
