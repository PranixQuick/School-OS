import { NextRequest, NextResponse } from 'next/server';
import { getSession, logAuthEvent, clientIpFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { SESSION_COOKIE } from '@/lib/session';
import { env } from '@/lib/env';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    // If the browser sent a cookie but verification failed, it was either tampered
    // or expired — log and clear it so the client sees a clean unauthenticated state.
    const stale = req.cookies.get(SESSION_COOKIE)?.value;
    if (stale) {
      await logAuthEvent({
        eventType: 'session_expired',
        ip: clientIpFromRequest(req),
        userAgent: req.headers.get('user-agent'),
      });
      const res = NextResponse.json({ session: null }, { status: 401 });
      res.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
      return res;
    }
    return NextResponse.json({ session: null }, { status: 401 });
  }

  const { data: usage } = await supabaseAdmin
    .from('usage_limits')
    .select('reports_generated, evaluations_done, broadcasts_sent, leads_scored, max_reports_per_month, max_evaluations_per_month, max_broadcasts_per_month, max_students, reset_at')
    .eq('school_id', session.schoolId)
    .single();

  return NextResponse.json({ session, usage: usage ?? null });
}
