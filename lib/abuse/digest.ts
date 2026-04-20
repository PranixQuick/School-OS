// lib/abuse/digest.ts
// Pure function that renders + sends the daily abuse digest. Extracted from the
// /api/cron/abuse-digest route so the /api/cron/abuse-monitor consolidated cron
// can invoke it directly without a second HTTP hop (Hobby plan has a 2-cron cap).

import { supabaseAdmin } from '@/lib/supabaseClient';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';

export interface AbuseDigestResult {
  ok: boolean;
  count: number;
  to: string;
  email_provider: string;
  email_error?: string;
}

interface AlertRow {
  id: string;
  severity: string;
  category: string;
  school_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

function renderDigest(alerts: AlertRow[]): { subject: string; body: string } {
  const today = new Date().toISOString().slice(0, 10);
  const count = alerts.length;
  const subject = count === 0
    ? `[School OS] All clear — 0 critical alerts in last 24h (${today})`
    : `[School OS] ${count} unacknowledged critical alert${count === 1 ? '' : 's'} (${today})`;

  const lines: string[] = [];
  lines.push(`School OS — daily abuse digest`);
  lines.push(`Date: ${today}`);
  lines.push(`Unacknowledged critical alerts (last 24h): ${count}`);
  lines.push('');

  if (count === 0) {
    lines.push('No action required.');
  } else {
    lines.push('— Incidents —');
    alerts.forEach((a, i) => {
      lines.push('');
      lines.push(`${i + 1}. [${a.category}] @ ${a.created_at}`);
      const p = a.payload ?? {};
      for (const [k, v] of Object.entries(p)) {
        const formatted = typeof v === 'object' ? JSON.stringify(v) : String(v);
        lines.push(`   ${k}: ${formatted}`);
      }
      lines.push(`   alert_id: ${a.id}`);
    });
    lines.push('');
    lines.push('— How to acknowledge —');
    lines.push(`Run: UPDATE alerts SET acknowledged_at = now() WHERE id = '<alert_id>';`);
  }

  lines.push('');
  lines.push('— end of digest —');
  return { subject, body: lines.join('\n') };
}

export async function runAbuseDigest(): Promise<AbuseDigestResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('alerts')
    .select('id, severity, category, school_id, payload, created_at')
    .eq('severity', 'critical')
    .is('acknowledged_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      ok: false,
      count: 0,
      to: env.FOUNDER_EMAIL ?? 'pranixailabs@gmail.com',
      email_provider: 'n/a',
      email_error: error.message,
    };
  }

  const alerts = (rows ?? []) as AlertRow[];
  const { subject, body } = renderDigest(alerts);
  const to = env.FOUNDER_EMAIL ?? 'pranixailabs@gmail.com';

  const result = await sendEmail({ to, subject, body });

  return {
    ok: result.success,
    count: alerts.length,
    to,
    email_provider: result.provider,
    email_error: result.error,
  };
}
