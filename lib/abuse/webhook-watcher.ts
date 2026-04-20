// lib/abuse/webhook-watcher.ts
// Two signals:
//   A. Unsigned WhatsApp webhook requests, globally, > 5 / 5 min.
//   B. Per-phone inbound WhatsApp volume > 50 / hour.
// Both create WARN alerts with 1h dedupe.

import { supabaseAdmin } from '@/lib/supabaseClient';

const UNSIGNED_WINDOW_MINUTES = 5;
const UNSIGNED_THRESHOLD = 5;
const PHONE_WINDOW_MINUTES = 60;
const PHONE_THRESHOLD = 50;
const DEDUPE_WINDOW_MINUTES = 60;

export interface WebhookWatchResult {
  unsignedCount: number;
  unsignedAlertCreated: boolean;
  spamPhones: Array<{ phone: string; count: number }>;
  spamAlertsCreated: number;
}

export async function runWebhookSpamWatch(): Promise<WebhookWatchResult> {
  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60 * 1000).toISOString();

  // ── Signal A: unsigned requests ────────────────────────────────────────────
  const unsignedSince = new Date(Date.now() - UNSIGNED_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count: unsignedCountRaw } = await supabaseAdmin
    .from('error_logs')
    .select('id', { count: 'exact', head: true })
    .eq('route', '/api/whatsapp/webhook')
    .eq('error', 'signature_invalid')
    .gte('created_at', unsignedSince);
  const unsignedCount = unsignedCountRaw ?? 0;

  let unsignedAlertCreated = false;
  if (unsignedCount > UNSIGNED_THRESHOLD) {
    const { count: existing } = await supabaseAdmin
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'webhook_spam')
      .contains('payload', { kind: 'unsigned_requests' })
      .gte('created_at', dedupeSince);

    if ((existing ?? 0) === 0) {
      const { error } = await supabaseAdmin.from('alerts').insert({
        severity: 'warn',
        category: 'webhook_spam',
        school_id: null,
        payload: {
          kind: 'unsigned_requests',
          count: unsignedCount,
          window_minutes: UNSIGNED_WINDOW_MINUTES,
          threshold: UNSIGNED_THRESHOLD,
        },
      });
      if (!error) unsignedAlertCreated = true;
    }
  }

  // ── Signal B: per-phone spam ───────────────────────────────────────────────
  const phoneSince = new Date(Date.now() - PHONE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: buckets } = await supabaseAdmin
    .from('webhook_rate_log')
    .select('phone, count')
    .gte('minute_bucket', phoneSince);

  const phoneTotals = new Map<string, number>();
  for (const row of buckets ?? []) {
    const phone = String(row.phone);
    phoneTotals.set(phone, (phoneTotals.get(phone) ?? 0) + Number(row.count ?? 0));
  }

  const spamPhones = Array.from(phoneTotals.entries())
    .filter(([, total]) => total > PHONE_THRESHOLD)
    .map(([phone, count]) => ({ phone, count }));

  let spamAlertsCreated = 0;
  for (const p of spamPhones) {
    const { count: existing } = await supabaseAdmin
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'webhook_spam')
      .contains('payload', { kind: 'phone_spam', phone: p.phone })
      .gte('created_at', dedupeSince);

    if ((existing ?? 0) > 0) continue;

    const { error } = await supabaseAdmin.from('alerts').insert({
      severity: 'warn',
      category: 'webhook_spam',
      school_id: null,
      payload: {
        kind: 'phone_spam',
        phone: p.phone,
        count: p.count,
        window_minutes: PHONE_WINDOW_MINUTES,
        threshold: PHONE_THRESHOLD,
      },
    });
    if (!error) spamAlertsCreated += 1;
  }

  return {
    unsignedCount,
    unsignedAlertCreated,
    spamPhones,
    spamAlertsCreated,
  };
}
