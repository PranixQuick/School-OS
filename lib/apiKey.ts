import { supabaseAdmin } from './supabaseClient';

// Window size for rate limiting (60 seconds)
const RATE_LIMIT_WINDOW_MS = 60_000;

// In-memory Map REMOVED — Vercel cold starts reset module-level state,
// making Map-based rate limits ineffective between function invocations.
// Replaced with DB-backed check against api_rate_log table.
// PREREQUISITE: api_rate_log table must exist before this code is deployed.

export async function validateAndTrackApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  if (!key || !key.startsWith('sk_schoolos_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, rate_limit_per_minute, is_active, requests_count')
    .eq('key', key)
    .eq('is_active', true)
    .single();

  if (error || !data) return { valid: false, error: 'API key not found' };

  // DB-backed rate limit — survives cold starts and scales across instances
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count } = await supabaseAdmin
    .from('api_rate_log')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', data.id)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= data.rate_limit_per_minute) {
    return { valid: false, error: 'Rate limit exceeded' };
  }

  // Log this request into the rate log table
  await supabaseAdmin.from('api_rate_log').insert({ api_key_id: data.id });

  // Update aggregate counter on api_keys (non-blocking — best effort)
  void supabaseAdmin
    .from('api_keys')
    .update({
      requests_count: data.requests_count + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', data.id);

  return { valid: true };
}

export async function getActiveApiKey(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('api_keys')
    .select('key')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data?.key ?? null;
}
