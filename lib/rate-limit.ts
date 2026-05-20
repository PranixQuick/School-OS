// lib/rate-limit.ts
// Two-layer sliding-window rate limiter + IP blocklist check
//   1. blocked_ips table — permanent/temporary IP ban (stops attacker IPs from polluting email window)
//   2. in-memory (fast path, best-effort, per-instance only)
//   3. Supabase-backed count of auth_events rows (authoritative across instances)

import { supabaseAdmin } from './supabaseClient';

type MemWindow = { count: number; firstAt: number };
const memory = new Map<string, MemWindow>();

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSec: number;
  source: 'memory' | 'db' | 'none' | 'blocklist';
}

function memHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const w = memory.get(key);
  if (!w || now - w.firstAt >= windowMs) {
    memory.set(key, { count: 1, firstAt: now });
    return { allowed: true, count: 1, remaining: limit - 1, retryAfterSec: 0, source: 'memory' };
  }
  w.count += 1;
  const allowed = w.count <= limit;
  return {
    allowed,
    count: w.count,
    remaining: Math.max(0, limit - w.count),
    retryAfterSec: allowed ? 0 : Math.ceil((windowMs - (now - w.firstAt)) / 1000),
    source: 'memory',
  };
}

async function countAuthEvents(params: {
  eventTypes: string[];
  email?: string;
  ip?: string;
  windowMs: number;
}): Promise<number> {
  const since = new Date(Date.now() - params.windowMs).toISOString();
  let q = supabaseAdmin
    .from('auth_events')
    .select('id', { count: 'exact', head: true })
    .in('event_type', params.eventTypes)
    .gte('created_at', since);
  if (params.email) q = q.eq('email', params.email);
  if (params.ip) q = q.eq('ip', params.ip);
  const { count, error } = await q;
  if (error) {
    console.error('[rate-limit] countAuthEvents error:', error.message);
    return 0;
  }
  return count ?? 0;
}

async function isIpBlocked(ip: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('blocked_ips')
    .select('ip')
    .eq('ip', ip)
    .gt('blocked_until', new Date().toISOString())
    .limit(1)
    .single();
  if (error) return false; // fail open — don't block legitimate users on DB error
  return !!data;
}

export const LOGIN_EMAIL_LIMIT = 5;
export const LOGIN_IP_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// SECURITY: Only .local test domains bypass rate limiting.
const EXEMPT_SUFFIXES = ['.local'];

export async function enforceLoginRateLimit(params: {
  email: string;
  ip: string | null;
}): Promise<RateLimitResult> {
  // Skip rate limiting ONLY for .local test accounts
  if (EXEMPT_SUFFIXES.some(d => params.email.endsWith(d))) {
    return { allowed: true, count: 0, remaining: 5, retryAfterSec: 0, source: 'none' };
  }

  // PHASE 0: IP blocklist check — reject known bad actors immediately
  // This prevents them from incrementing the per-email failure counter
  if (params.ip) {
    const blocked = await isIpBlocked(params.ip);
    if (blocked) {
      return {
        allowed: false,
        count: 0,
        remaining: 0,
        retryAfterSec: 86400, // 24h — don't tell attacker exactly when unblocked
        source: 'blocklist',
      };
    }
  }

  // Fire-and-forget cleanup of expired api_rate_log rows (non-blocking)
  void Promise.resolve(
    supabaseAdmin.from('api_rate_log').delete().lt('expires_at', new Date().toISOString())
  ).catch(() => {});

  const memEmail = memHit(`login:email:${params.email}`, LOGIN_EMAIL_LIMIT, LOGIN_WINDOW_MS);
  if (!memEmail.allowed) return memEmail;
  if (params.ip) {
    const memIp = memHit(`login:ip:${params.ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
    if (!memIp.allowed) return memIp;
  }

  const [emailFails, ipFails] = await Promise.all([
    countAuthEvents({
      eventTypes: ['login_failure', 'rate_limited'],
      email: params.email,
      windowMs: LOGIN_WINDOW_MS,
    }),
    params.ip
      ? countAuthEvents({
          eventTypes: ['login_failure', 'rate_limited'],
          ip: params.ip,
          windowMs: LOGIN_WINDOW_MS,
        })
      : Promise.resolve(0),
  ]);

  if (emailFails >= LOGIN_EMAIL_LIMIT) {
    return {
      allowed: false,
      count: emailFails,
      remaining: 0,
      retryAfterSec: Math.ceil(LOGIN_WINDOW_MS / 1000),
      source: 'db',
    };
  }
  if (params.ip && ipFails >= LOGIN_IP_LIMIT) {
    return {
      allowed: false,
      count: ipFails,
      remaining: 0,
      retryAfterSec: Math.ceil(LOGIN_WINDOW_MS / 1000),
      source: 'db',
    };
  }
  return {
    allowed: true,
    count: Math.max(emailFails, ipFails),
    remaining: LOGIN_EMAIL_LIMIT - emailFails,
    retryAfterSec: 0,
    source: 'db',
  };
}


/**
 * Returns true when the request carries a valid E2E bypass header.
 * Safe in production: bypass is a no-op unless E2E_BYPASS_SECRET is set
 * AND the request sends the matching header value (≥16 chars).
 */
export function isE2EBypass(headerValue: string | null): boolean {
  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret || secret.length < 16) return false;
  return headerValue === secret;
}
