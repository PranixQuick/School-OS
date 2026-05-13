// app/api/admin/principal-briefing/generate/route.ts
// Batch 5 — Generate today's AI principal briefing via Claude.
// Gathers operational snapshot → calls Claude API → upserts to principal_briefings.
// Schema: principal_briefings.UNIQUE(school_id, date) confirmed.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return (await requireAdminSession(req)); }
  catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try { return (await requirePrincipalSession(req)); }
    catch (pe) { if (pe instanceof PrincipalAuthError) return null; throw pe; }
  }
}

export async function POST(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  const today = new Date().toISOString().slice(0, 10);

  // ── Step 1: Gather operational data snapshot ───────────────────────────────
  const [attRes, feesRes, leaveRes, tcRes, proofsRes, notifRes, hwRes, schoolRes] =
    await Promise.all([
      supabaseAdmin.from('attendance').select('status', { count: 'exact' })
        .eq('school_id', schoolId).eq('date', today),
      supabaseAdmin.from('fees').select('amount')
        .eq('school_id', schoolId).in('status', ['pending', 'overdue']),
      supabaseAdmin.from('teacher_leave_requests').select('id', { count: 'exact' })
        .eq('school_id', schoolId).eq('status', 'pending'),
      supabaseAdmin.from('transfer_certificates').select('id', { count: 'exact' })
        .eq('school_id', schoolId).eq('status', 'pending'),
      supabaseAdmin.from('classroom_proofs').select('id', { count: 'exact' })
        .eq('school_id', schoolId).eq('status', 'pending'),
      supabaseAdmin.from('notifications').select('id', { count: 'exact' })
        .eq('school_id', schoolId).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      supabaseAdmin.from('homework').select('id', { count: 'exact' })
        .eq('school_id', schoolId).eq('due_date', today),
      supabaseAdmin.from('schools').select('name').eq('id', schoolId).maybeSingle(),
    ]);

  const attRows = attRes.data ?? [];
  const absent = attRows.filter(r => r.status === 'absent').length;
  const totalAtt = attRows.length;
  const pendingFees = feesRes.data ?? [];
  const totalDue = pendingFees.reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const schoolName = schoolRes.data?.name ?? 'the school';

  const kpiSnapshot = {
    date: today,
    attendance: { absent, total: totalAtt },
    fees: { count: pendingFees.length, total_due: totalDue },
    pending_leave: leaveRes.count ?? 0,
    pending_tc: tcRes.count ?? 0,
    pending_proofs: proofsRes.count ?? 0,
    notifications_24h: notifRes.count ?? 0,
    homework_due: hwRes.count ?? 0,
  };

  // ── Step 2: Call Claude API ────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });

  const prompt = `You are a school management AI assistant. Generate a concise daily briefing for a school principal.

Today's operational data for ${schoolName}:
- Attendance: ${absent} absences out of ${totalAtt} students marked today
- Outstanding fees: ${pendingFees.length} fees totaling ₹${totalDue.toLocaleString('en-IN')}
- Pending leave approvals: ${leaveRes.count ?? 0}
- Pending transfer certificates: ${tcRes.count ?? 0}
- Unreviewed classroom proofs: ${proofsRes.count ?? 0}
- Notifications sent (24h): ${notifRes.count ?? 0}
- Homework due today: ${hwRes.count ?? 0}

Write a 3-4 sentence morning briefing in a professional but warm tone.
Lead with the most important operational item. Use Indian school context.
End with one suggested priority action for the day.`;

  let briefingText: string;
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return NextResponse.json({ error: `Claude API error: ${aiRes.status} ${errText.slice(0, 200)}` }, { status: 502 });
    }
    const aiData = await aiRes.json() as { content?: { type: string; text: string }[] };
    briefingText = aiData.content?.[0]?.text ?? 'Unable to generate briefing.';
  } catch (e) {
    return NextResponse.json({ error: `Claude API unreachable: ${String(e)}` }, { status: 502 });
  }

  // ── Step 3: Upsert to principal_briefings ──────────────────────────────────
  const { data: upserted, error: upsertErr } = await supabaseAdmin
    .from('principal_briefings')
    .upsert({
      school_id: schoolId,
      date: today,
      briefing_text: briefingText,
      kpi_snapshot: kpiSnapshot,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'school_id,date' })
    .select('briefing_text, kpi_snapshot, generated_at, date')
    .single();

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({
    briefing_text: upserted.briefing_text,
    kpi_snapshot: upserted.kpi_snapshot,
    generated_at: upserted.generated_at,
    today,
  });
}
