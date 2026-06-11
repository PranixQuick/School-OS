// lib/parent-auth.ts
// Parent session management via JWT cookie.
// All /api/parent/* routes call getParentSession(req) to validate.
// AG-5 parity: now checks revoked_sessions denylist on every verification,
// mirroring the staff session pattern in lib/session.ts.

import { SignJWT, jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { env } from '@/lib/env';

const COOKIE = 'parent_session';
const EXPIRY = '7d';
const MAX_AGE = 60 * 60 * 24 * 7;
const ALG = 'HS256';
const ISSUER = 'edprosys-parent';

export interface ParentSessionPayload {
  parentId: string;
  schoolId: string;
  studentId: string;
  phone: string;
}

function secret() {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

// Lazy admin client — only created when denylist check is needed.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Unified parent credential verification — the SINGLE source of truth used by
 * every /api/parent/* action route (complaints, fees, consent, student, …).
 *
 * Mirrors the login route exactly: prefer the hashed PIN, fall back to a legacy
 * plaintext PIN and transparently upgrade it to a hash. Previously each action
 * route re-implemented this as `.eq('access_pin', pin)` (plaintext only), which
 * broke the moment a parent logged in — login migrates the PIN to hashed and
 * nulls the plaintext, so subsequent actions were rejected with "Invalid PIN".
 *
 * Returns the parent row on success, or null on bad credentials.
 * Throws only on genuine lookup errors or duplicate-phone ambiguity.
 */
export async function verifyParentCredentials(phone: string, pin: string) {
  const db = adminClient();
  const { data: parents, error } = await db
    .from('parents')
    .select('id, school_id, student_id, name, phone, access_pin, access_pin_hashed, is_active')
    .eq('phone', phone)
    .eq('is_active', true);
  if (error) throw new Error(`Parent lookup failed: ${error.message}`);
  if (!parents || parents.length === 0) return null;
  if (parents.length > 1) throw new Error('Multiple accounts match this phone');

  const parent = parents[0];
  let valid = false;
  if (parent.access_pin_hashed) {
    valid = await bcrypt.compare(pin, parent.access_pin_hashed);
  } else if (parent.access_pin) {
    valid = parent.access_pin === pin;
    if (valid) {
      const hashed = await bcrypt.hash(pin, 10);
      await db.from('parents').update({ access_pin_hashed: hashed, access_pin: null }).eq('id', parent.id);
    }
  }
  if (!valid) return null;
  return { id: parent.id, school_id: parent.school_id, student_id: parent.student_id, name: parent.name, phone: parent.phone };
}

export async function signParentSession(payload: ParentSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(EXPIRY)
    .sign(secret());
}

export async function getParentSession(req: NextRequest): Promise<ParentSessionPayload | null> {
  try {
    const token = req.cookies.get(COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });

    // AG-5 parity: check revocation denylist.
    // Uses parentId as the user_id key (consistent with how parent logout writes the denylist).
    // Fail-open on DB error — a Supabase outage must not lock parents out.
    if (payload.iat) {
      const pId = (payload as Record<string, unknown>).parentId as string | undefined;
      if (pId) {
        try {
          const { data } = await adminClient()
            .from('revoked_sessions')
            .select('id')
            .eq('user_id', pId)
            .eq('issued_at', payload.iat)
            .maybeSingle();
          if (data) return null; // token revoked
        } catch {
          // Fail-open: denylist check failure must not block parent login
        }
      }
    }

    return payload as unknown as ParentSessionPayload;
  } catch {
    return null;
  }
}

export function parentSessionCookieOptions() {
  return {
    name: COOKIE,
    maxAge: MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}
