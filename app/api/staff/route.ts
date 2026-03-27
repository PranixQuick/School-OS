import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('staff')
    .select('id, name, role, subject')
    .eq('school_id', SCHOOL_ID)
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data ?? [] });
}
