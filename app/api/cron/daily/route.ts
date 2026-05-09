import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { runAllJobsForSchool } from '@/lib/cronEngine';
import { verifyCronAuth } from '@/lib/cron-auth';

// Vercel calls this daily at 2am UTC via vercel.json crons config.
// It processes ALL active schools sequentially.
// Auth is delegated to verifyCronAuth which accepts the Vercel cron header
// or a Bearer CRON_SECRET. See lib/cron-auth.ts for the contract.

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
