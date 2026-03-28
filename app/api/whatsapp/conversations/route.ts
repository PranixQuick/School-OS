// PATH: app/api/whatsapp/conversations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('id, phone_number, intent, message, response, language, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) throw new Error(error.message);

    return NextResponse.json({ conversations: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
