import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(req: NextRequest) {
  try {
    const priority = req.nextUrl.searchParams.get('priority');
    const status = req.nextUrl.searchParams.get('status');

    let query = supabaseAdmin
      .from('inquiries')
      .select('id, parent_name, child_name, child_age, target_class, source, phone, email, score, priority, status, has_sibling, notes, created_at')
      .eq('school_id', SCHOOL_ID)
      .order('score', { ascending: false });

    if (priority) query = query.eq('priority', priority);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    console.error('Admissions list error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json() as { id: string; status: string };
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('inquiries')
      .update({ status })
      .eq('id', id)
      .eq('school_id', SCHOOL_ID);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admissions patch error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
