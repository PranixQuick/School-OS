import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(req: NextRequest) {
  const staffId = req.nextUrl.searchParams.get('staffId');

  let query = supabaseAdmin
    .from('recordings')
    .select('id, file_name, coaching_score, eval_report, status, uploaded_at, staff_id')
    .eq('school_id', SCHOOL_ID)
    .order('uploaded_at', { ascending: false })
    .limit(20);

  if (staffId) query = query.eq('staff_id', staffId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recordings: data ?? [] });
}
