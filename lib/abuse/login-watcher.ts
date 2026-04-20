// lib/abuse/login-watcher.ts
// Scans auth_events for the last 5 minutes. Any IP with 10+ login_failure /
// rate_limited events generates a CRITICAL alert and an entry in blocked_ips
// with a 24h TTL. Duplicate alerts for the same IP within 1h are suppressed
// to keep the digest readable.

import { supabaseAdmin } from '@/lib/supabaseClient';

const WINDOW_MINUTES = 5;
const THRESHOLD = 10;
const BLOCK_DURATION_HOURS = 24;
const DEDUPE_WINDOW_MINUTES = 60;

export interface IpSummary {
  ip: string;
  failures: number;
  emails: string[];
  lastAt: string;
}

export interface LoginWatchResult {
  scanned: number;
  flagged: IpSummary[];
  newAlerts: number;
  newlyBlocked: string[];
  skippedExisting: number;
}

export async function runLoginAnomalyWatch(): Promise<LoginWatchResult> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: events } = await supabaseAdmin
    .from('auth_events')
    .select('ip, email, created_at')
    .in('event_type', ['login_failure', 'rate_limited'])
    .gte('created_at', windowStart)
    .not('ip', 'is', null);

  const ipMap = new Map<string, IpSummary>();
  for (const ev of events ?? []) {
    const ip = String(ev.ip);
    const entry = ipMap.get(ip) ?? { ip, failures: 0, emails: [], lastAt: '' };
    entry.failures += 1;
    const email = ev.email ? String(ev.email) : null;
    if (email && !entry.emails.includes(email)) entry.emails.push(email);
    const created = String(ev.created_at);
    if (created > entry.lastAt) entry.lastAt = created;
    ipMap.set(ip, entry);
  }

  const flagged = Array.from(ipMap.values()).filter((s) => s.failures >= THRESHOLD);

  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const blockedUntil = new Date(Date.now() + BLOCK_DURATION_HOURS * 60 * 60 * 1000).toISOString();

  let newAlerts = 0;
  let skippedExisting = 0;
  const newlyBlocked: string[] = [];

  for (const s of flagged) {
    const { count: existing } = await supabaseAdmin
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'login_anomaly')
      .contains('payload', { ip: s.ip })
      .gte('created_at', dedupeSince);

    if ((existing ?? 0) > 0) {
      skippedExisting += 1;
      continue;
    }

    const { error: alertErr } = await supabaseAdmin.from('alerts').insert({
      severity: 'critical',
      category: 'login_anomaly',
      school_id: null,
      payload: {
        ip: s.ip,
        failures: s.failures,
        emails_targeted: s.emails,
        window_minutes: WINDOW_MINUTES,
        last_seen_at: s.lastAt,
        action: `ip_blocked_${BLOCK_DURATION_HOURS}h`,
      },
    });
    if (!alertErr) newAlerts += 1;

    const { error: blockErr } = await supabaseAdmin
      .from('blocked_ips')
      .upsert(
        {
          ip: s.ip,
          reason: `${s.failures} login failures in ${WINDOW_MINUTES} min`,
          blocked_until: blockedUntil,
        },
        { onConflict: 'ip' }
      );
    if (!blockErr) newlyBlocked.push(s.ip);
  }

  return {
    scanned: events?.length ?? 0,
    flagged,
    newAlerts,
    newlyBlocked,
    skippedExisting,
  };
}
