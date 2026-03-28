import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// Server-side supabase with anon key (for auth)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Session type
export interface SchoolSession {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  plan: string;
  userId: string;
  userEmail: string;
  userRole: string;
  userName: string;
}

// Read session from cookie (set during login)
export async function getSession(req?: NextRequest): Promise<SchoolSession | null> {
  try {
    let sessionCookie: string | undefined;

    if (req) {
      sessionCookie = req.cookies.get('school_session')?.value;
    } else {
      const cookieStore = await cookies();
      sessionCookie = cookieStore.get('school_session')?.value;
    }

    if (!sessionCookie) return null;
    return JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8')) as SchoolSession;
  } catch {
    return null;
  }
}

// Create session cookie value
export function encodeSession(session: SchoolSession): string {
  return Buffer.from(JSON.stringify(session), 'utf-8').toString('base64');
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
