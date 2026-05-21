// app/api/admin/internships/students/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('students')
    .select('id, name, class, section').eq('school_id', session.schoolId).eq('is_active', true)
    .order('class').order('name').limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: (data ?? []).map(s => ({ id: s.id, name: s.name, class: `${s.class}${s.section ? '-'+s.section : ''}` })) });
}
