import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  // Also return usage stats
  const { data: usage } = await supabaseAdmin
    .from('usage_limits')
    .select('reports_generated, evaluations_done, broadcasts_sent, leads_scored, max_reports_per_month, max_evaluations_per_month, max_broadcasts_per_month, max_students, reset_at')
    .eq('school_id', session.schoolId)
    .single();

  return NextResponse.json({ session, usage: usage ?? null });
}
