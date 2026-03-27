// /lib/apiKey.ts
import { supabaseAdmin } from './supabaseClient';

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const rateLimitCache = new Map<string, { count: number; windowStart: number }>();

export async function validateAndTrackApiKey(key: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  if (!key || !key.startsWith('sk_schoolos_')) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, key, rate_limit_per_minute, is_active, requests_count')
    .eq('key', key)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { valid: false, error: 'API key not found or inactive' };
  }

  // In-memory rate limit check
  const now = Date.now();
  const cached = rateLimitCache.get(key);
  if (cached && now - cached.windowStart < RATE_LIMIT_WINDOW_MS) {
    if (cached.count >= data.rate_limit_per_minute) {
      return { valid: false, error: `Rate limit exceeded: ${data.rate_limit_per_minute} req/min` };
    }
    cached.count++;
  } else {
    rateLimitCache.set(key, { count: 1, windowStart: now });
  }

  // Update usage in DB (fire and forget)
  supabaseAdmin
    .from('api_keys')
    .update({
      requests_count: data.requests_count + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', data.id)
    .then(() => {})
    .catch(() => {});

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
