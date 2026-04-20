import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabaseClient';
import {
  verifySession,
  SESSION_COOKIE,
  type SchoolSession,
} from './session';

// Re-export SchoolSession so all existing callers (`import { SchoolSession } from '@/lib/auth'`)
// keep working unchanged.
export type { SchoolSession };

// Server-side supabase with anon key (for auth flows).
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Read and verify the session cookie. Returns null for missing/expired/invalid tokens.
export async function getSession(req?: NextRequest): Promise<SchoolSession | null> {
  let token: string | undefined;
  if (req) {
    token = req.cookies.get(SESSION_COOKIE)?.value;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value;
  }
  if (!token) return null;
  return await verifySession(token);
}

// Plan feature flags
export function getPlanFeatures(plan: string) {
  const features: Record<string, Record<string, boolean>> = {
    starter: { whatsapp: false, risk_detection: false, ptm: false, api_access: false },
    growth:  { whatsapp: true,  risk_detection: true,  ptm: true,  api_access: false },
    campus:  { whatsapp: true,  risk_detection: true,  ptm: true,  api_access: true  },
  };
  return features[plan] ?? features.starter;
}

export type AuthEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'session_expired'
  | 'rate_limited'
  | 'password_migrated'
  | 'magic_link_sent';

export interface LogAuthEventInput {
  eventType: AuthEventType;
  schoolId?: string | null;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

// Best-effort audit log. Never throws — auth events must not break login.
export async function logAuthEvent(input: LogAuthEventInput): Promise<void> {
  try {
    await supabaseAdmin.from('auth_events').insert({
      event_type: input.eventType,
      school_id: input.schoolId ?? null,
      user_id: input.userId ?? null,
      email: input.email ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error('[auth_events] insert failed:', err);
  }
}

// Extract client IP from a NextRequest. Handles common proxy headers.
export function clientIpFromRequest(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? null;
}
