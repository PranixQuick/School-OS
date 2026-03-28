import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const counter = req.nextUrl.searchParams.get('counter') ?? '';

    const { data, error } = await supabaseAdmin
      .from('usage_limits')
      .select('*')
      .eq('school_id', schoolId)
      .single();

    if (error || !data) {
      return NextResponse.json({ allowed: true }); // allow if no limits record
    }

    const used = (data as Record<string, number>)[counter] ?? 0;
    const max = (data as Record<string, number>)[`max_${counter}`] ?? -1;

    return NextResponse.json({
      allowed: max === -1 || used < max,
      used, max,
      plan: data.plan,
    });
  } catch (err) {
    return NextResponse.json({ allowed: true, error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { counter, amount = 1 } = await req.json() as { counter: string; amount?: number };

    // Get current usage
    const { data } = await supabaseAdmin
      .from('usage_limits')
      .select('*')
      .eq('school_id', schoolId)
      .single();

    if (!data) return NextResponse.json({ allowed: true });

    const used = (data as Record<string, number>)[counter] ?? 0;
    const max = (data as Record<string, number>)[`max_${counter}`] ?? -1;

    if (max !== -1 && used >= max) {
      return NextResponse.json({ allowed: false, used, max, plan: data.plan });
    }

    // Increment
    await supabaseAdmin
      .from('usage_limits')
      .update({ [counter]: used + amount, updated_at: new Date().toISOString() })
      .eq('school_id', schoolId);

    return NextResponse.json({ allowed: true, used: used + amount, max, plan: data.plan });
  } catch (err) {
    return NextResponse.json({ allowed: true, error: String(err) });
  }
}
