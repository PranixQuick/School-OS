import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';
import {
  runFeeReminders,
  runRiskDetection,
  runPrincipalBriefing,
  runAllJobsForSchool,
} from '@/lib/cronEngine';

// Manual trigger: POST /api/cron/run
// Body: { job?: 'fee_reminders' | 'risk_detection' | 'principal_briefing' | 'all' }
export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { job = 'all' } = await req.json() as { job?: string };

    // Fetch school record
    const { data: school, error } = await supabaseAdmin
      .from('schools')
      .select('id, name, plan')
      .eq('id', schoolId)
      .single();

    if (error || !school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    let results;

    switch (job) {
      case 'fee_reminders':
        results = [await runFeeReminders(school, 'manual')];
        break;
      case 'risk_detection':
        results = [await runRiskDetection(school, 'manual')];
        break;
      case 'principal_briefing':
        results = [await runPrincipalBriefing(school, 'manual')];
        break;
      case 'all':
      default:
        results = await runAllJobsForSchool(school, 'manual');
        break;
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      triggered_by: 'manual',
      school: school.name,
      jobs_run: results.length,
      succeeded,
      failed,
      results,
    });

  } catch (err) {
    console.error('[Cron Run] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: return recent cron run history for this school
export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    const { data, error } = await supabaseAdmin
      .from('cron_runs')
      .select('id, job_name, status, triggered_by, result, error, started_at, completed_at, duration_ms')
      .eq('school_id', schoolId)
      .order('started_at', { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);

    const summary = {
      total: data?.length ?? 0,
      success: data?.filter(r => r.status === 'success').length ?? 0,
      failed: data?.filter(r => r.status === 'failed').length ?? 0,
      skipped: data?.filter(r => r.status === 'skipped').length ?? 0,
    };

    return NextResponse.json({ runs: data ?? [], summary });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
