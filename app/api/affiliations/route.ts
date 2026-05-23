// app/api/affiliations/route.ts
// Bible Phase 8 Step 8.3: University affiliation management.
// Tracks which college is affiliated to which university, with programme
// approvals and validity periods.

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  // Resolve institution_id
  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', session.schoolId).maybeSingle();

  if (!school?.institution_id) {
    return NextResponse.json({ affiliations: [] });
  }

  // Get affiliations where this institution is either the college or the university
  const { data, error } = await supabaseAdmin
    .from('affiliations')
    .select(`
      *,
      college:college_institution_id(id, name, institution_type),
      university:university_institution_id(id, name, institution_type)
    `)
    .or(`college_institution_id.eq.${school.institution_id},university_institution_id.eq.${school.institution_id}`)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ affiliations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 });

  if (!['admin', 'principal', 'registrar', 'super_admin'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Insufficient role' }, { status: 403 });
  }

  const body = await req.json() as {
    college_institution_id: string;
    university_institution_id: string;
    affiliation_number?: string;
    valid_from?: string;
    valid_until?: string;
    programmes_approved?: string[];
    status?: string;
  };

  if (!body.college_institution_id || !body.university_institution_id) {
    return NextResponse.json({
      error: 'college_institution_id and university_institution_id required',
    }, { status: 400 });
  }

  const validStatuses = ['active', 'expired', 'revoked', 'pending'];
  const status = body.status && validStatuses.includes(body.status) ? body.status : 'active';

  const { data, error } = await supabaseAdmin
    .from('affiliations')
    .insert({
      college_institution_id: body.college_institution_id,
      university_institution_id: body.university_institution_id,
      affiliation_number: body.affiliation_number ?? null,
      valid_from: body.valid_from ?? null,
      valid_until: body.valid_until ?? null,
      programmes_approved: body.programmes_approved ?? null,
      status,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, affiliation_id: data.id }, { status: 201 });
}
