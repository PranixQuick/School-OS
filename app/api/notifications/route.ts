import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20');

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id, type, title, message, target_count, module, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) throw new Error(error.message);
    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
