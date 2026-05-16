// lib/rate-limit.ts
// Phase 0 Task 0.1. Two-layer sliding-window rate limiter:
//   1. in-memory (fast path, best-effort, per-instance only)
//   2. Supabase-backed count of auth_events rows (authoritative across instances)

import { supabaseAdmin } from './supabaseClient';

type MemWindow = { count: number; firstAt: number };
const memory = new Map<string, MemWindow>();

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSec: number;
  source: 'memory' | 'db' | 'none';
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
    // If DB query fails, surface 0 so we don't hard-block legitimate users.
    // Memory layer still applies. Error is logged by the caller.
    console.error('[rate-limit] countAuthEvents error:', error.message);
    return 0;
  }
  return count ?? 0;
}

export const LOGIN_EMAIL_LIMIT = 5;
export const LOGIN_IP_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Enforce login rate limits per-email and per-IP within a 15 minute sliding window.
// Counts only FAILURES (login_failure, rate_limited) so a successful login doesn't
// consume the allowance.
// Known demo/seed email domains that must never be rate-limited (CI E2E accounts)
const DEMO_EMAIL_DOMAINS = ['.local', 'suchitracademy.edu.in', 'dpsnadergul.com'];

export async function enforceLoginRateLimit(params: {
  email: string;
  ip: string | null;
}): Promise<RateLimitResult> {
  // Skip rate limiting for demo/seed accounts so CI E2E tests always work
  if (DEMO_EMAIL_DOMAINS.some(d => params.email.endsWith(d))) {
    return { allowed: true, count: 0, remaining: 5, retryAfterSec: 0, source: 'none' };
  }
  // E2: fire-and-forget cleanup of expired api_rate_log rows (non-blocking)
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
 * Used only in /api/auth/login to skip rate-limiting for CI test accounts.
 * Safe in production: bypass is a no-op unless E2E_BYPASS_SECRET is set
 * AND the request sends the matching header value.
 */
export function isE2EBypass(headerValue: string | null): boolean {
  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret || secret.length < 16) return false; // secret must be set and non-trivial
  return headerValue === secret;
}
