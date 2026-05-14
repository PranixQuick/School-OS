// app/api/admin/ops/cron/retry/route.ts
// Batch 12 — Retry a specific cron job on demand.
// Internally calls the relevant API route for the given job_name.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { job_name } = body as { job_name?: string };
  if (!job_name) return NextResponse.json({ error: 'job_name required' }, { status: 400 });

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  // Forward the school session cookie for internal API calls
  const cookie = req.headers.get('cookie') ?? '';

  try {
    let targetUrl: string;
    switch (job_name) {
      case 'principal_briefing':
        targetUrl = `${baseUrl}/api/admin/principal-briefing/generate`;
        break;
      case 'dispatch':
        targetUrl = `${baseUrl}/api/admin/ops/notifications/dispatch`;
        break;
      case 'fee_reminders':
        // Re-scan overdue: mark any past-due pending fees as overdue
        await supabaseAdmin.from('fees')
          .update({ status: 'overdue' })
          .eq('school_id', schoolId)
          .eq('status', 'pending')
          .lt('due_date', new Date().toISOString().slice(0, 10));
        return NextResponse.json({ triggered: true, job_name, note: 'Overdue fees re-scanned' });
      case 'risk_detection':
        targetUrl = `${baseUrl}/api/admin/risk-flags/generate`;
        break;
      case 'school_health_monitor': {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
        const DISPATCH_SECRET = process.env.DISPATCH_SECRET ?? '';
        if (!DISPATCH_SECRET) return NextResponse.json({ error: 'DISPATCH_SECRET not configured' }, { status: 500 });
        const hmRes = await fetch(`${SUPABASE_URL}/functions/v1/school-health-monitor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-DISPATCH-SECRET': DISPATCH_SECRET },
          body: '{}' 
        });
        const hmData = await hmRes.json() as Record<string, unknown>;
        return NextResponse.json({ triggered: true, job_name, response: hmData });
      }
      default:
        return NextResponse.json({ error: `Unknown job_name: ${job_name}` }, { status: 400 });
    }

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: '{}',
    });
    const data = await res.json() as Record<string, unknown>;
    return NextResponse.json({ triggered: true, job_name, response: data });
  } catch (e) {
    return NextResponse.json({ triggered: false, job_name, error: String(e) }, { status: 502 });
  }
}
