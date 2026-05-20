// app/api/anganwadi/children/route.ts
// Returns all active students for the current session's school.
// Used by all Anganwadi UI pages (growth, immunization, beneficiary).
// Reuses existing students table — no schema change.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, name, class, section, roll_number, date_of_birth')
    .eq('school_id', session.schoolId)
    .eq('is_active', true)
    .order('class')
    .order('name');

  return NextResponse.json({ students: students ?? [] });
}
