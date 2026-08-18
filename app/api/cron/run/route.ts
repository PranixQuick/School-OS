import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireTenant, isMissingSchoolId } from '@/lib/getSchoolId';
import {
  runFeeReminders,
  runRiskDetection,
  runPrincipalBriefing,
  runAllJobsForSchool,
} from '@/lib/cronEngine';

// SEC-CRITICAL-2 — 2026-08-17.
// This route previously derived its school_id from the forgeable `x-school-id`
// request header with no session check at all. Because it fans out to the cron
// engine (fee reminders, risk detection, principal briefing — all of which send
// WhatsApp/SMS through paid providers), an unauthenticated caller could trigger
// unlimited billable message sends against any school in the platform.
//
// It now requires a verified `school_session` cookie, and POST additionally
// requires a role that is allowed to run school-wide automation.

// Roles permitted to manually trigger automation for their own school.
const TRIGGER_ROLES = ['owner', 'principal', 'admin', 'admin_staff', 'super_admin'];

// Manual trigger: POST /api/cron/run
// Body: { job?: 'fee_reminders' | 'risk_detection' | 'principal_briefing' | 'all' }
export async function POST(req: NextRequest) {
  let schoolId: string;
  let role: string;
  let email: string;
  try {
    const ctx = await requireTenant(req);
    schoolId = ctx.schoolId;
    role = ctx.role;
    email = ctx.email;
  } catch (err) {
    if (isMissingSchoolId(err)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    throw err;
  }

  if (!TRIGGER_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `Role '${role || 'unknown'}' is not permitted to trigger automation` },
      { status: 403 }
    );
  }

  try {
    const { job = 'all' } = (await req.json().catch(() => ({}))) as { job?: string };

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

    console.info(
      `[cron/run] manual trigger job=${job} school=${schoolId} by=${email} role=${role} ` +
        `jobs=${results.length} ok=${succeeded} failed=${failed}`
    );

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
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 });
  }
}

// GET: return recent cron run history for this school
export async function GET(req: NextRequest) {
  let schoolId: string;
  try {
    schoolId = (await requireTenant(req)).schoolId;
  } catch (err) {
    if (isMissingSchoolId(err)) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    throw err;
  }

  try {
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
    console.error('[Cron Run] History error:', err);
    return NextResponse.json({ error: 'Failed to load cron history' }, { status: 500 });
  }
}
