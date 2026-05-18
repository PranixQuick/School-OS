import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId, MissingSchoolIdError } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { data, error } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, subject')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ staff: data ?? [], count: (data ?? []).length });
  } catch (err) {
    if (err instanceof MissingSchoolIdError) return NextResponse.json({ error: 'No session' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
