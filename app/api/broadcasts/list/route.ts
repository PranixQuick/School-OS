import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('broadcasts')
    .select('id, type, title, message, target_classes, target_count, sent_count, status, sent_at, created_at')
    .eq('school_id', SCHOOL_ID)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ broadcasts: data ?? [] });
}
