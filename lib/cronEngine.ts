import { supabaseAdmin } from './supabaseClient';
import { callClaude } from './claudeClient';
import { logActivity, logNotification, logError } from './logger';
import { processPendingNotifications } from './dispatcher';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CronJobResult {
  job: string;
  schoolId: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

interface SchoolRecord {
  id: string;
  name: string;
  plan: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function trackRun(params: {
  schoolId: string;
  jobName: string;
  triggeredBy: 'auto' | 'manual' | 'api';
}): Promise<string> {
  const { data } = await supabaseAdmin
    .from('cron_runs')
    .insert({
      school_id: params.schoolId,
      job_name: params.jobName,
      status: 'running',
      triggered_by: params.triggeredBy,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  return data?.id ?? '';
}

async function completeRun(runId: string, params: {
  status: 'success' | 'failed' | 'skipped';
  result?: Record<string, unknown>;
  error?: string;
  startedAt: number;
}) {
  if (!runId) return;
  const durationMs = Date.now() - params.startedAt;
  await supabaseAdmin.from('cron_runs').update({
    status: params.status,
    result: params.result ?? {},
    error: params.error ?? null,
    completed_at: new Date().toISOString(),
    duration_ms: durationMs,
  }).eq('id', runId);
}

// ─── Job 1: Fee Reminder Engine ───────────────────────────────────────────────

export async function runFeeReminders(
  school: SchoolRecord,
  triggeredBy: 'auto' | 'manual' | 'api' = 'auto'
): Promise<CronJobResult> {
  const startedAt = Date.now();
  const runId = await trackRun({ schoolId: school.id, jobName: 'fee_reminders', triggeredBy });

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: fees } = await supabaseAdmin
      .from('fees')
      .select('id, student_id, fee_type, amount, due_date, status, students(name, parent_name, phone_parent)')
      .eq('school_id', school.id)
      .in('status', ['overdue', 'pending'])
      .lte('due_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);

    if (!fees || fees.length === 0) {
      await completeRun(runId, { status: 'skipped', result: { reason: 'No pending fees within 7 days' }, startedAt });
      return { job: 'fee_reminders', schoolId: school.id, success: true, data: { reminders_sent: 0 }, durationMs: Date.now() - startedAt };
    }

    // Filter: exclude fees already reminded today
    const { data: alreadyReminded } = await supabaseAdmin
      .from('fee_reminder_log')
      .select('fee_id')
      .eq('school_id', school.id)
      .eq('sent_date', today);

    const remindedIds = new Set((alreadyReminded ?? []).map(r => r.fee_id));
    const feesToRemind = fees.filter(f => !remindedIds.has(f.id));

    if (feesToRemind.length === 0) {
      await completeRun(runId, { status: 'skipped', result: { reason: 'All fees already reminded today' }, startedAt });
      return { job: 'fee_reminders', schoolId: school.id, success: true, data: { reminders_sent: 0 }, durationMs: Date.now() - startedAt };
    }

    let remindersSent = 0;

    for (const fee of feesToRemind) {
      try {
        const studentArr = fee.students as { name: string; parent_name: string; phone_parent: string }[] | null;
        const student = Array.isArray(studentArr) ? studentArr[0] : null;
        if (!student) continue;

        const message = await callClaude(
          `You are a school admin. Write a brief, polite WhatsApp fee reminder. Under 80 words. No markdown.`,
          `Student: ${student.name}, Parent: ${student.parent_name ?? 'Parent'}
Fee: ${fee.fee_type} - ₹${fee.amount}, Due: ${fee.due_date}, Status: ${fee.status}
School: ${school.name}. Include a friendly payment request and contact number 040-12345678.`,
          160
        );

        const { data: notif } = await supabaseAdmin.from('notifications').insert({
          school_id: school.id,
          type: 'fee_reminder',
          title: `Fee Reminder: ${student.name}`,
          message,
          target_count: 1,
          module: 'cron',
          status: 'pending',
          channel: 'whatsapp',
          attempts: 0,
        }).select('id').single();

        await supabaseAdmin.from('fee_reminder_log').upsert({
          school_id: school.id,
          fee_id: fee.id,
          sent_date: today,
          notification_id: notif?.id ?? null,
        }, { onConflict: 'school_id,fee_id,sent_date', ignoreDuplicates: true });

        remindersSent++;
      } catch (e) {
        console.error(`Fee reminder failed for fee ${fee.id}:`, e);
      }
    }

    const result = { reminders_sent: remindersSent, total_eligible: feesToRemind.length };

    await logActivity({
      schoolId: school.id,
      action: `Cron: Generated ${remindersSent} fee reminders — dispatching now`,
      module: 'broadcasts',
      details: result,
    });

    // Dispatch the new notifications immediately
    const dispatchResult = await processPendingNotifications(school.id, { limit: remindersSent + 5 });

    await completeRun(runId, {
      status: 'success',
      result: { ...result, dispatch: dispatchResult },
      startedAt,
    });

    return {
      job: 'fee_reminders',
      schoolId: school.id,
      success: true,
      data: { ...result, dispatch: dispatchResult },
      durationMs: Date.now() - startedAt,
    };

  } catch (err) {
    const error = String(err);
    await logError({ route: '/api/cron/daily:fee_reminders', error, schoolId: school.id });
    await completeRun(runId, { status: 'failed', error, startedAt });
    return { job: 'fee_reminders', schoolId: school.id, success: false, error, durationMs: Date.now() - startedAt };
  }
}

// ─── Job 2: Risk Detection ────────────────────────────────────────────────────

export async function runRiskDetection(
  school: SchoolRecord,
  triggeredBy: 'auto' | 'manual' | 'api' = 'auto'
): Promise<CronJobResult> {
  const startedAt = Date.now();
  const runId = await trackRun({ schoolId: school.id, jobName: 'risk_detection', triggeredBy });

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [studentsRes, attendanceRes, academicRes, feesRes] = await Promise.all([
      supabaseAdmin.from('students').select('id, name, class, section').eq('school_id', school.id).eq('is_active', true),
      supabaseAdmin.from('attendance').select('student_id, status').eq('school_id', school.id).gte('date', thirtyDaysAgo),
      supabaseAdmin.from('academic_records').select('student_id, marks_obtained, max_marks').eq('school_id', school.id),
      supabaseAdmin.from('fees').select('student_id, status').eq('school_id', school.id).eq('status', 'overdue'),
    ]);

    const students = studentsRes.data ?? [];
    const attendance = attendanceRes.data ?? [];
    const academics = academicRes.data ?? [];
    const overdues = new Set((feesRes.data ?? []).map(f => f.student_id));

    const flagsToUpsert: Record<string, unknown>[] = [];
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;

    for (const student of students) {
      const studentAtt = attendance.filter(a => a.student_id === student.id);
      const presentCount = studentAtt.filter(a => a.status === 'present').length;
      const attendancePct = studentAtt.length > 0 ? Math.round((presentCount / studentAtt.length) * 100) : 100;

      const studentAcad = academics.filter(a => a.student_id === student.id);
      const avgScore = studentAcad.length > 0
        ? Math.round(studentAcad.reduce((s, r) => s + (Number(r.marks_obtained) / Number(r.max_marks || 1)) * 100, 0) / studentAcad.length)
        : 100;

      const feeOverdue = overdues.has(student.id);
      const riskFactors: string[] = [];

      if (attendancePct < 75) riskFactors.push(`Low attendance: ${attendancePct}%`);
      if (avgScore < 50) riskFactors.push(`Low avg score: ${avgScore}%`);
      if (feeOverdue) riskFactors.push('Fee overdue');

      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (riskFactors.length >= 3) { riskLevel = 'critical'; criticalCount++; }
      else if (riskFactors.length === 2) { riskLevel = 'high'; highCount++; }
      else if (riskFactors.length === 1) { riskLevel = 'medium'; mediumCount++; }

      if (riskFactors.length > 0) {
        let aiSummary = `Requires attention: ${riskFactors.join(', ')}.`;
        if (riskLevel === 'high' || riskLevel === 'critical') {
          try {
            aiSummary = await callClaude(
              `School counsellor. Write a 1-sentence action recommendation for at-risk student. Specific and actionable.`,
              `Student: ${student.name}, Class ${student.class}. Issues: ${riskFactors.join(', ')}. Attendance: ${attendancePct}%, Score: ${avgScore}%.`,
              100
            );
          } catch { /* keep default */ }
        }

        flagsToUpsert.push({
          school_id: school.id,
          student_id: student.id,
          risk_level: riskLevel,
          risk_factors: riskFactors,
          ai_summary: aiSummary,
          attendance_pct: attendancePct,
          avg_score: avgScore,
          fee_overdue: feeOverdue,
          flagged_at: new Date().toISOString(),
          resolved_at: null,
        });
      }
    }

    if (flagsToUpsert.length > 0) {
      await supabaseAdmin.from('student_risk_flags')
        .upsert(flagsToUpsert, { onConflict: 'school_id,student_id' });
    }

    let dispatchResult = null;
    if (criticalCount > 0) {
      await logNotification({
        schoolId: school.id,
        type: 'risk',
        title: `⚠️ ${criticalCount} Critical Risk Student${criticalCount > 1 ? 's' : ''} Detected`,
        message: `Automated scan found ${criticalCount} critical and ${highCount} high-risk students requiring immediate attention.`,
        targetCount: criticalCount + highCount,
        module: 'cron',
      });
      // Dispatch the alert to admins
      dispatchResult = await processPendingNotifications(school.id, { limit: 5 });
    }

    const result: Record<string, unknown> = {
      scanned: students.length,
      flagged: flagsToUpsert.length,
      breakdown: { critical: criticalCount, high: highCount, medium: mediumCount },
    };
    if (dispatchResult) result.dispatch = dispatchResult;

    await logActivity({
      schoolId: school.id,
      action: `Cron: Risk scan — ${flagsToUpsert.length} students flagged (${criticalCount} critical)`,
      module: 'risk',
      details: result,
    });

    await completeRun(runId, { status: 'success', result, startedAt });
    return { job: 'risk_detection', schoolId: school.id, success: true, data: result, durationMs: Date.now() - startedAt };

  } catch (err) {
    const error = String(err);
    await logError({ route: '/api/cron/daily:risk_detection', error, schoolId: school.id });
    await completeRun(runId, { status: 'failed', error, startedAt });
    return { job: 'risk_detection', schoolId: school.id, success: false, error, durationMs: Date.now() - startedAt };
  }
}

// ─── Job 3: Principal Daily Brief ─────────────────────────────────────────────

export async function runPrincipalBriefing(
  school: SchoolRecord,
  triggeredBy: 'auto' | 'manual' | 'api' = 'auto'
): Promise<CronJobResult> {
  const startedAt = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const runId = await trackRun({ schoolId: school.id, jobName: 'principal_briefing', triggeredBy });

  try {
    // Idempotency: skip if generated within 4 hours
    const { data: existing } = await supabaseAdmin
      .from('principal_briefings')
      .select('id, generated_at')
      .eq('school_id', school.id)
      .eq('date', today)
      .single();

    if (existing?.generated_at) {
      const generatedAt = new Date(existing.generated_at).getTime();
      if (Date.now() - generatedAt < 4 * 3600 * 1000) {
        await completeRun(runId, { status: 'skipped', result: { reason: 'Already generated within 4h' }, startedAt });
        return { job: 'principal_briefing', schoolId: school.id, success: true, data: { skipped: true }, durationMs: Date.now() - startedAt };
      }
    }

    const [studentsRes, attendanceRes, feesRes, leadsRes, evalsRes, teacherAttRes, riskRes, eventsRes] = await Promise.all([
      supabaseAdmin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', school.id).eq('is_active', true),
      supabaseAdmin.from('attendance').select('status').eq('school_id', school.id).eq('date', today),
      supabaseAdmin.from('fees').select('amount, status').eq('school_id', school.id).in('status', ['pending', 'overdue']),
      supabaseAdmin.from('inquiries').select('priority, status').eq('school_id', school.id).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabaseAdmin.from('recordings').select('coaching_score').eq('school_id', school.id).eq('status', 'done').gte('uploaded_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      supabaseAdmin.from('teacher_attendance').select('status').eq('school_id', school.id).eq('date', today),
      supabaseAdmin.from('student_risk_flags').select('risk_level').eq('school_id', school.id).is('resolved_at', null),
      supabaseAdmin.from('events').select('title, event_date').eq('school_id', school.id).gte('event_date', today).order('event_date').limit(3),
    ]);

    const totalStudents = studentsRes.count ?? 0;
    const attRecords = attendanceRes.data ?? [];
    const presentCount = attRecords.filter(a => a.status === 'present').length;
    const attendancePct = attRecords.length > 0 ? Math.round((presentCount / attRecords.length) * 100) : 0;
    const pendingFees = feesRes.data ?? [];
    const totalFeePending = pendingFees.reduce((s, f) => s + Number(f.amount ?? 0), 0);
    const leads = leadsRes.data ?? [];
    const evalScores = evalsRes.data ?? [];
    const avgEvalScore = evalScores.length ? Math.round(evalScores.reduce((s, e) => s + Number(e.coaching_score ?? 0), 0) / evalScores.length) : 0;
    const teacherPresent = (teacherAttRes.data ?? []).filter(t => t.status === 'present').length;
    const teacherTotal = teacherAttRes.data?.length ?? 0;
    const risks = riskRes.data ?? [];
    const criticalRisks = risks.filter(r => r.risk_level === 'critical').length;
    const upcomingEvents = eventsRes.data ?? [];

    const kpiSnapshot = {
      total_students: totalStudents,
      attendance_pct: attendancePct,
      pending_fees_amount: totalFeePending,
      new_leads_week: leads.length,
      high_priority_leads: leads.filter(l => l.priority === 'high').length,
      avg_eval_score: avgEvalScore || 'N/A',
      teachers_present: teacherTotal > 0 ? `${teacherPresent}/${teacherTotal}` : 'Not marked',
      at_risk_students: risks.length,
      critical_risks: criticalRisks,
    };

    const briefingText = await callClaude(
      `You are an AI school intelligence system writing a daily briefing for the school principal.
Write professionally but conversationally. Use bullet points with • symbol. Be specific with numbers.
Flag urgent concerns clearly. Under 280 words. Format: greeting → 5-6 bullets → action items.`,
      `School: ${school.name} | Date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

DATA:
- Total students: ${totalStudents}
- Student attendance today: ${attendancePct}% (${presentCount}/${attRecords.length || 'not recorded'})
- Teachers present: ${teacherTotal > 0 ? `${teacherPresent}/${teacherTotal}` : 'attendance not marked'}
- Pending fees: ₹${Math.round(totalFeePending / 1000)}K (${pendingFees.filter(f => f.status === 'overdue').length} overdue)
- Admissions leads this week: ${leads.length} (${leads.filter(l => l.priority === 'high').length} high priority)
- At-risk students: ${risks.length} total (${criticalRisks} critical)
- Teaching quality avg: ${avgEvalScore ? `${avgEvalScore}/10` : 'no recent evals'}
- Upcoming events: ${upcomingEvents.length ? upcomingEvents.map(e => `${e.title} (${e.event_date})`).join(', ') : 'none'}

Generate the principal daily briefing now.`,
      550
    );

    const { data, error } = await supabaseAdmin
      .from('principal_briefings')
      .upsert({
        school_id: school.id,
        date: today,
        briefing_text: briefingText,
        kpi_snapshot: kpiSnapshot,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'school_id,date' })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    // Create notification for briefing and dispatch to admins via email
    await supabaseAdmin.from('notifications').insert({
      school_id: school.id,
      type: 'system',
      title: `Daily Briefing — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
      message: briefingText.slice(0, 500) + (briefingText.length > 500 ? '...' : ''),
      module: 'cron',
      reference_id: data?.id ?? null,
      status: 'pending',
      channel: 'email',
      attempts: 0,
    });

    // Dispatch email to admins
    const dispatchResult = await processPendingNotifications(school.id, { limit: 5 });

    await logActivity({
      schoolId: school.id,
      action: 'Cron: Daily principal briefing generated and dispatched',
      module: 'settings',
      details: { ...kpiSnapshot as Record<string, unknown>, dispatch: dispatchResult },
    });

    const result = { briefing_id: data?.id, kpis: kpiSnapshot, dispatch: dispatchResult };
    await completeRun(runId, { status: 'success', result: result as Record<string, unknown>, startedAt });
    return { job: 'principal_briefing', schoolId: school.id, success: true, data: result as Record<string, unknown>, durationMs: Date.now() - startedAt };

  } catch (err) {
    const error = String(err);
    await logError({ route: '/api/cron/daily:principal_briefing', error, schoolId: school.id });
    await completeRun(runId, { status: 'failed', error, startedAt });
    return { job: 'principal_briefing', schoolId: school.id, success: false, error, durationMs: Date.now() - startedAt };
  }
}

// ─── Job 4: Dispatch pending notifications ────────────────────────────────────

export async function runDispatch(
  school: SchoolRecord,
  triggeredBy: 'auto' | 'manual' | 'api' = 'auto'
): Promise<CronJobResult> {
  const startedAt = Date.now();
  const runId = await trackRun({ schoolId: school.id, jobName: 'dispatch', triggeredBy });

  try {
    const result = await processPendingNotifications(school.id, { limit: 50 });

    await completeRun(runId, { status: result.processed === 0 ? 'skipped' : 'success', result: result as unknown as Record<string, unknown>, startedAt });
    return { job: 'dispatch', schoolId: school.id, success: true, data: result as unknown as Record<string, unknown>, durationMs: Date.now() - startedAt };
  } catch (err) {
    const error = String(err);
    await logError({ route: '/api/cron/daily:dispatch', error, schoolId: school.id });
    await completeRun(runId, { status: 'failed', error, startedAt });
    return { job: 'dispatch', schoolId: school.id, success: false, error, durationMs: Date.now() - startedAt };
  }
}

// ─── Master: Run all jobs for one school ──────────────────────────────────────

export async function runAllJobsForSchool(
  school: SchoolRecord,
  triggeredBy: 'auto' | 'manual' | 'api' = 'auto'
): Promise<CronJobResult[]> {
  console.log(`[Cron] Running all jobs for: ${school.name} (${school.id})`);

  const results: CronJobResult[] = [];
  results.push(await runFeeReminders(school, triggeredBy));
  results.push(await runRiskDetection(school, triggeredBy));
  results.push(await runPrincipalBriefing(school, triggeredBy));
  // Final sweep: dispatch any remaining pending notifications
  results.push(await runDispatch(school, triggeredBy));

  const succeeded = results.filter(r => r.success).length;
  console.log(`[Cron] ${school.name}: ${succeeded}/${results.length} jobs succeeded`);
  return results;
}
