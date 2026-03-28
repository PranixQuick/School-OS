import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { runAllJobsForSchool } from '@/lib/cronEngine';

// Vercel calls this daily at 2am UTC via vercel.json crons config
// It processes ALL active schools sequentially

export async function GET(req: NextRequest) {
  // Security: Vercel cron requests include a special header
  // For manual calls we allow a secret key
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all active schools
    const { data: schools, error } = await supabaseAdmin
      .from('schools')
      .select('id, name, plan')
      .eq('is_active', true)
      .order('created_at');

    if (error) throw new Error(error.message);
    if (!schools || schools.length === 0) {
      return NextResponse.json({ message: 'No active schools', processed: 0 });
    }

    const allResults = [];

    for (const school of schools) {
      const schoolResults = await runAllJobsForSchool(school, 'auto');
      allResults.push({ school: school.name, school_id: school.id, jobs: schoolResults });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      schools_processed: schools.length,
      results: allResults,
    });

  } catch (err) {
    console.error('[Cron Daily] Fatal error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
