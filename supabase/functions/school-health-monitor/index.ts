import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DISPATCH_SECRET = Deno.env.get('DISPATCH_SECRET') ?? '';

interface Alert { type: string; severity: 'critical' | 'warning' | 'info'; message: string; }

// Per-query helper: never throws; returns count and records any query error.
async function safeCount(
  supabase: ReturnType<typeof createClient>, table: string,
  filters: (q: any) => any, errors: string[]
): Promise<number> {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    q = filters(q);
    const { count, error } = await q;
    if (error) { errors.push(`${table}: ${error.message}`); return 0; }
    return count ?? 0;
  } catch (e) { errors.push(`${table}: ${String(e).slice(0, 120)}`); return 0; }
}

async function checkSchoolHealth(
  supabase: ReturnType<typeof createClient>, schoolId: string, errors: string[]
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const today = new Date().toISOString().slice(0, 10);

  try {
    const { data: att, error: attErr } = await supabase
      .from('attendance').select('status').eq('school_id', schoolId).eq('date', today);
    if (attErr) errors.push(`attendance: ${attErr.message}`);
    else if (att && att.length > 0) {
      const absent = att.filter((a: { status: string }) => a.status === 'absent').length;
      const pct = Math.round((1 - absent / att.length) * 100);
      if (pct < 75) alerts.push({ type: 'attendance', severity: 'critical', message: `⚠️ Attendance alert: Only ${pct}% present today (${absent} absences out of ${att.length} students).` });
      else if (pct < 85) alerts.push({ type: 'attendance', severity: 'warning', message: `Attendance is ${pct}% today — slightly below normal.` });
    }
  } catch (e) { errors.push(`attendance: ${String(e).slice(0, 120)}`); }

  const overdueCount = await safeCount(supabase, 'fees', (q) => q.eq('school_id', schoolId).eq('status', 'overdue'), errors);
  if (overdueCount > 10) alerts.push({ type: 'fees', severity: 'warning', message: `💰 ${overdueCount} overdue fee records. Consider sending reminders.` });

  const leavePending = await safeCount(supabase, 'teacher_leave_requests', (q) => q.eq('school_id', schoolId).eq('status', 'pending'), errors);
  if (leavePending > 3) alerts.push({ type: 'leave', severity: 'warning', message: `📋 ${leavePending} leave requests pending approval.` });

  const highRisk = await safeCount(supabase, 'student_risk_flags', (q) => q.eq('school_id', schoolId).eq('risk_level', 'high').eq('reviewed', false), errors);
  if (highRisk > 0) alerts.push({ type: 'risk', severity: 'warning', message: `🚩 ${highRisk} high-risk student(s) flagged and not yet reviewed.` });

  const incidentCount = await safeCount(supabase, 'health_incidents', (q) => q.eq('school_id', schoolId).eq('incident_date', today), errors);
  if (incidentCount > 2) alerts.push({ type: 'health', severity: 'critical', message: `🏥 ${incidentCount} health incidents recorded today. Please review.` });

  const stuckCount = await safeCount(supabase, 'notifications', (q) => q.eq('school_id', schoolId).eq('status', 'failed'), errors);
  if (stuckCount > 5) alerts.push({ type: 'notifications', severity: 'info', message: `📱 ${stuckCount} WhatsApp notifications failed. Visit Ops Console to retry.` });

  const tripsNotStarted = await safeCount(supabase, 'transport_trips', (q) => q.eq('school_id', schoolId).eq('trip_date', today).eq('status', 'scheduled'), errors);
  if (tripsNotStarted > 0) alerts.push({ type: 'transport', severity: 'info', message: `🚌 ${tripsNotStarted} transport trip(s) scheduled but not yet started today.` });

  return alerts;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', function: 'school-health-monitor', version: 'v6' }), { headers: { 'Content-Type': 'application/json' } });
  }
  const secret = req.headers.get('X-DISPATCH-SECRET') ?? '';
  if (!DISPATCH_SECRET || secret !== DISPATCH_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const errors: string[] = [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    // Resolve active schools; tolerate a missing is_active column.
    let schools: { id: string; name: string }[] = [];
    const r1 = await supabase.from('schools').select('id, name, is_active');
    if (r1.error) {
      const r2 = await supabase.from('schools').select('id, name');
      if (r2.error) { errors.push(`schools: ${r2.error.message}`); }
      else schools = (r2.data ?? []) as { id: string; name: string }[];
    } else {
      schools = ((r1.data ?? []) as { id: string; name: string; is_active?: boolean }[])
        .filter((s) => s.is_active !== false);
    }

    const summary: Record<string, { alerts: number; critical: number; warnings: string[] }> = {};
    for (const school of schools) {
      try {
        const alerts = await checkSchoolHealth(supabase, school.id, errors);
        if (!alerts.length) { summary[school.id] = { alerts: 0, critical: 0, warnings: [] }; continue; }
        const critical = alerts.filter((a) => a.severity === 'critical');
        const warnings = alerts.filter((a) => a.severity === 'warning');
        const info = alerts.filter((a) => a.severity === 'info');
        const lines = [
          `🏫 *${school.name} — Daily Health Report*`,
          `📅 ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`,
          '',
          ...critical.map((a) => a.message), ...warnings.map((a) => a.message), ...info.map((a) => a.message),
          '', `_Review at: https://www.edprosys.com/admin/observability_`,
        ];
        const { error: insErr } = await supabase.from('notifications').insert({
          school_id: school.id, type: 'system',
          title: `Daily health report — ${alerts.length} item(s) need attention`,
          message: lines.join('\n'), target_count: 1, module: 'health_monitor',
          status: 'pending', channel: 'whatsapp', attempts: 0,
        });
        if (insErr) errors.push(`notif_insert[${school.id}]: ${insErr.message}`);
        summary[school.id] = { alerts: alerts.length, critical: critical.length, warnings: [...warnings, ...info].map((a) => a.message) };
      } catch (e) { errors.push(`school[${school.id}]: ${String(e).slice(0, 160)}`); }
    }

    return new Response(JSON.stringify({ ok: errors.length === 0, schools_checked: schools.length, summary, errors }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    // Never 500 the cron — return a debuggable payload instead.
    return new Response(JSON.stringify({ ok: false, fatal: String(e instanceof Error ? e.message : e), errors }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
});
