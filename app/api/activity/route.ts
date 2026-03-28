import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const module = req.nextUrl.searchParams.get('module');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20');

    let query = supabaseAdmin
      .from('activity_logs')
      .select('id, action, module, actor_email, details, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (module) query = query.eq('module', module);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ logs: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
