import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

const UPGRADE_MESSAGES: Record<string, string> = {
  reports_generated: 'Report card limit reached. Upgrade to Pro for 200 reports/month.',
  evaluations_done: 'Teacher evaluation limit reached. Upgrade to Pro for 50 evaluations/month.',
  broadcasts_sent: 'Broadcast limit reached. Upgrade to Pro for 100 broadcasts/month.',
  leads_scored: 'Lead scoring limit reached. Upgrade your plan.',
};

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
      return NextResponse.json({ allowed: true });
    }

    const used = (data as Record<string, number>)[counter] ?? 0;
    const max = (data as Record<string, number>)[`max_${counter}`] ?? -1;
    const allowed = max === -1 || used < max;

    return NextResponse.json({
      allowed,
      used,
      max,
      plan: data.plan,
      pct: max === -1 ? 0 : Math.round((used / max) * 100),
      upgrade_message: !allowed ? (UPGRADE_MESSAGES[counter] ?? 'Plan limit reached. Upgrade to continue.') : null,
      upgrade_url: !allowed ? '/billing' : null,
    });
  } catch (err) {
    return NextResponse.json({ allowed: true, error: String(err) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { counter, amount = 1 } = await req.json() as { counter: string; amount?: number };

    const { data } = await supabaseAdmin
      .from('usage_limits')
      .select('*')
      .eq('school_id', schoolId)
      .single();

    if (!data) return NextResponse.json({ allowed: true });

    const used = (data as Record<string, number>)[counter] ?? 0;
    const max = (data as Record<string, number>)[`max_${counter}`] ?? -1;

    if (max !== -1 && used >= max) {
      return NextResponse.json({
        allowed: false,
        used,
        max,
        plan: data.plan,
        upgrade_message: UPGRADE_MESSAGES[counter] ?? 'Plan limit reached. Upgrade to continue.',
        upgrade_url: '/billing',
      });
    }

    await supabaseAdmin
      .from('usage_limits')
      .update({ [counter]: used + amount, updated_at: new Date().toISOString() })
      .eq('school_id', schoolId);

    return NextResponse.json({
      allowed: true,
      used: used + amount,
      max,
      plan: data.plan,
      pct: max === -1 ? 0 : Math.round(((used + amount) / max) * 100),
    });
  } catch (err) {
    return NextResponse.json({ allowed: true, error: String(err) });
  }
}
