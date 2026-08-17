// lib/rate-limit.ts
// Production-grade two-layer rate limiter with:
//   1. blocked_ips table — individual IP bans (pre-checked, stops pollution)
//   2. Subnet blocking — /24 CIDR range bans for distributed attacks  
//   3. In-memory sliding window (fast path, per-instance best-effort)
//   4. DB-backed sliding window (authoritative cross-instance)
//   5. Login anomaly detection — velocity spike alerting
//   6. CI domain exemption — .internal and .local never rate-limited

import { supabaseAdmin } from './supabaseClient';

type MemWindow = { count: number; firstAt: number };
const memory = new Map<string, MemWindow>();

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSec: number;
  source: 'memory' | 'db' | 'none' | 'blocklist' | 'subnet';
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
  if (params.ip)    q = q.eq('ip', params.ip);
  const { count, error } = await q;
  if (error) { console.error('[rate-limit] countAuthEvents:', error.message); return 0; }
  return count ?? 0;
}

async function isIpBlocked(ip: string): Promise<boolean> {
  // Check exact IP
  const { data } = await supabaseAdmin
    .from('blocked_ips')
    .select('ip')
    .eq('ip', ip)
    .gt('blocked_until', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (data) return true;

  // Check /24 subnet block (e.g. 13.203.216.0/24 → matches 13.203.216.65)
  const subnet24 = ip.split('.').slice(0, 3).join('.') + '.0/24';
  const { data: subnetData } = await supabaseAdmin
    .from('blocked_ips')
    .select('ip')
    .eq('ip', subnet24)
    .gt('blocked_until', new Date().toISOString())
    .limit(1)
    .maybeSingle();
  return !!subnetData;
}

export const LOGIN_EMAIL_LIMIT = 5;
export const LOGIN_IP_LIMIT    = 10;
export const LOGIN_WINDOW_MS   = 15 * 60 * 1000;

// CI and internal test domains are completely exempt from rate limiting.
// These accounts are managed via Supabase Admin API, not the login UI.
// Adding .internal here ensures CI accounts (ci.*.@edprosys.internal)
// are never locked out by accumulated attack failures on shared IPs.
const EXEMPT_SUFFIXES = ['.local', '.internal', '.demo'];

export async function enforceLoginRateLimit(params: {
  email: string;
  ip: string | null;
}): Promise<RateLimitResult> {
  // Skip rate limiting for CI/internal domains
  if (EXEMPT_SUFFIXES.some(d => params.email.endsWith(d))) {
    return { allowed: true, count: 0, remaining: LOGIN_EMAIL_LIMIT, retryAfterSec: 0, source: 'none' };
  }

  // Phase 0: IP + subnet blocklist — reject immediately, no failure event logged
  if (params.ip) {
    const blocked = await isIpBlocked(params.ip);
    if (blocked) {
      return {
        allowed: false, count: 0, remaining: 0,
        retryAfterSec: 86400, // 24h — don't reveal exact unblock time
        source: 'blocklist',
      };
    }
  }

  // Anomaly detection: auto-block IPs with >50 failures in the last hour
  // (distributed attack detection beyond the 15-min window)
  if (params.ip) {
    const hourFails = await countAuthEvents({
      eventTypes: ['login_failure'],
      ip: params.ip,
      windowMs: 60 * 60 * 1000,
    });
    if (hourFails >= 50) {
      // Auto-block this IP for 24h and delete its failure events
      await supabaseAdmin.from('blocked_ips').upsert({
        ip: params.ip,
        reason: `auto-blocked: ${hourFails} failures/hour`,
        blocked_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'ip' });
      await supabaseAdmin.from('auth_events').delete()
        .eq('ip', params.ip).eq('event_type', 'login_failure');
      return {
        allowed: false, count: hourFails, remaining: 0,
        retryAfterSec: 86400,
        source: 'blocklist',
      };
    }
  }

  // Fire-and-forget cleanup of expired api_rate_log
  void supabaseAdmin.from('api_rate_log').delete()
    .lt('expires_at', new Date().toISOString()).then(() => {});

  // Layer 1: in-memory fast path
  const memEmail = memHit(`login:email:${params.email}`, LOGIN_EMAIL_LIMIT, LOGIN_WINDOW_MS);
  if (!memEmail.allowed) return memEmail;
  if (params.ip) {
    const memIp = memHit(`login:ip:${params.ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
    if (!memIp.allowed) return memIp;
  }

  // Layer 2: DB authoritative counts
  const [emailFails, ipFails] = await Promise.all([
    countAuthEvents({
      eventTypes: ['login_failure', 'rate_limited'],
      email: params.email,
      windowMs: LOGIN_WINDOW_MS,
    }),
    params.ip
      ? countAuthEvents({ eventTypes: ['login_failure', 'rate_limited'], ip: params.ip, windowMs: LOGIN_WINDOW_MS })
      : Promise.resolve(0),
  ]);

  if (emailFails >= LOGIN_EMAIL_LIMIT) {
    return { allowed: false, count: emailFails, remaining: 0, retryAfterSec: Math.ceil(LOGIN_WINDOW_MS / 1000), source: 'db' };
  }
  if (params.ip && ipFails >= LOGIN_IP_LIMIT) {
    return { allowed: false, count: ipFails, remaining: 0, retryAfterSec: Math.ceil(LOGIN_WINDOW_MS / 1000), source: 'db' };
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
 * Safe in production: bypass is a no-op unless E2E_BYPASS_SECRET is ≥16 chars
 * AND the request sends the exact matching value.
 */
// SEC-CRITICAL-3 — 2026-08-17
//
// The doc comment above previously claimed this was "safe in production". It
// was not. In app/api/auth/login/route.ts the bypass branch runs BEFORE
// enforceLoginRateLimit() and issues a real, full-privilege session for ANY
// active row in school_users — no password, no rate limit, no lockout, and no
// expiry on the secret itself. Because .github/workflows/ci.yml ran the E2E
// suite against https://www.edprosys.com with E2E_BYPASS_SECRET populated,
// production necessarily had that value set. One static, never-rotated string
// unlocked every account in every tenant.
//
// Fixed:
//   1. HARD OFF on the production deployment. VERCEL_ENV === 'production'
//      short-circuits before the secret is read, so the bypass cannot be used
//      against production even if the variable is still configured there. It is
//      checked first and cannot be overridden by any other variable.
//   2. Constant-time comparison, so the secret is not discoverable by timing.
//   3. Attempts against production are logged loudly.
//
// NOT gated on NODE_ENV: `next start` sets NODE_ENV=production, and CI runs the
// PR E2E suite against a locally started production build on localhost. Gating
// on NODE_ENV would disable the bypass in CI, which is where it is legitimate.
// VERCEL_ENV is 'production' only on the real production deployment.
//
// The permanent fix is to delete this mechanism and have E2E authenticate with
// seeded test accounts. Tracked separately; this removes the production
// exposure now without breaking the PR gate.

/** True only on the real production Vercel deployment. */
function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

/** Length-safe constant-time string comparison. */
function timingSafeStringEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function isE2EBypass(headerValue: string | null): boolean {
  if (isProductionDeployment()) {
    if (headerValue) {
      console.error(
        '[SECURITY] E2E login bypass attempted against production and refused. ' +
          'If this came from CI, that job must be pointed at a preview deployment.'
      );
    }
    return false;
  }

  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret || secret.length < 16) return false;
  if (!headerValue) return false;
  return timingSafeStringEqual(headerValue, secret);
}
