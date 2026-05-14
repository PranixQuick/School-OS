// app/api/admin/nl-ops/route.ts
// Batch 5C — Natural Language Operations interface.
// Admin/principal types a plain English instruction → Claude Haiku interprets intent
// → executes the action → logs to conversations → returns structured result.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// Supported operation intents
const INTENTS = ['broadcast_parents','fee_reminder','generate_briefing','run_risk_scan','list_pending','summarise_today','unknown'] as const;
type NLIntent = typeof INTENTS[number];

interface NLParams {
  class_filter: string | null;
  section_filter: string | null;
  message_override: string | null;
  fee_type_filter: string | null;
}

interface NLParseResult {
  intent: NLIntent;
  params: NLParams;
  preview: string;
}

async function parseIntent(instruction: string): Promise<NLParseResult> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
  const fallback: NLParseResult = {
    intent: 'unknown', params: { class_filter: null, section_filter: null, message_override: null, fee_type_filter: null },
    preview: 'Could not understand the instruction.',
  };
  if (!ANTHROPIC_API_KEY) return fallback;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Classify this school admin instruction into one intent. Respond with ONLY valid JSON, no markdown.

Instruction: "${instruction.slice(0, 300)}"

Return:
{
  "intent": "broadcast_parents|fee_reminder|generate_briefing|run_risk_scan|list_pending|summarise_today|unknown",
  "params": {
    "class_filter": "Class 5" or null,
    "section_filter": "A" or null,
    "message_override": "extracted message text" or null,
    "fee_type_filter": "tuition" or null
  },
  "preview": "one sentence describing what will be executed"
}

Intent rules:
- broadcast_parents: send message/announcement to parents
- fee_reminder: remind about fees/dues/payments
- generate_briefing: generate/create briefing/report for today
- run_risk_scan: scan/check/find at-risk students
- list_pending: show/list pending approvals/leaves/requests
- summarise_today: today's summary/stats/overview
- unknown: anything else`,
        }],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json() as { content?: { text?: string }[] };
    const text = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(text) as Partial<NLParseResult>;
    const intent = INTENTS.includes(parsed.intent as NLIntent) ? (parsed.intent as NLIntent) : 'unknown';
    return {
      intent,
      params: {
        class_filter: parsed.params?.class_filter ?? null,
        section_filter: parsed.params?.section_filter ?? null,
        message_override: parsed.params?.message_override ?? null,
        fee_type_filter: parsed.params?.fee_type_filter ?? null,
      },
      preview: parsed.preview ?? 'Action will be executed.',
    };
  } catch (e) {
    console.error('[NLOps] Parse error:', String(e).slice(0,100));
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { instruction } = body as { instruction?: string };
  if (!instruction?.trim()) return NextResponse.json({ error: 'instruction required' }, { status: 400 });

  // Step 1: Parse intent
  const { intent, params, preview } = await parseIntent(instruction);

  // Step 2: Execute
  let result: Record<string, unknown> = {};
  const today = new Date().toISOString().slice(0, 10);

  try {
    switch (intent) {
      case 'broadcast_parents': {
        let query = supabaseAdmin.from('students').select('id, phone_parent, name, class, section')
          .eq('school_id', schoolId).eq('is_active', true);
        if (params.class_filter) query = query.eq('class', params.class_filter);
        if (params.section_filter) query = query.eq('section', params.section_filter);
        const { data: students } = await query;
        const count = students?.length ?? 0;
        const message = params.message_override ?? instruction;
        if (count > 0) {
          await supabaseAdmin.from('notifications').insert({
            school_id: schoolId, type: 'broadcast', title: message, message,
            target_count: count, module: 'nl_ops', status: 'pending', channel: 'whatsapp', attempts: 0,
          });
        }
        result = { executed: 'broadcast', recipients: count, preview };
        break;
      }
      case 'fee_reminder': {
        // Query fees + students separately to avoid join type complexity
        let feesQuery = supabaseAdmin
          .from('fees').select('id, student_id, amount, fee_type')
          .eq('school_id', schoolId).in('status', ['pending','overdue']);
        if (params.fee_type_filter) feesQuery = feesQuery.eq('fee_type', params.fee_type_filter);
        const { data: feeRows } = await feesQuery;
        const rows = feeRows ?? [];
        if (rows.length > 0) {
          // Batch fetch student names
          const studentIds = [...new Set(rows.map(f => f.student_id))];
          const { data: studentRows } = await supabaseAdmin
            .from('students').select('id, name').in('id', studentIds);
          const studentMap = Object.fromEntries((studentRows ?? []).map(s => [s.id, s.name as string]));
          const inserts = rows.map((f) => ({
            school_id: schoolId, type: 'fee_reminder',
            title: `Fee reminder for ${studentMap[f.student_id] ?? 'Student'}`,
            message: `Dear Parent, ${studentMap[f.student_id] ?? 'your child'} has an outstanding ${String(f.fee_type)} fee of ₹${Number(f.amount).toLocaleString('en-IN')}. Please clear it at the earliest.`,
            target_count: 1, module: 'nl_ops', reference_id: f.id, status: 'pending', channel: 'whatsapp', attempts: 0,
          }));
          await supabaseAdmin.from('notifications').insert(inserts);
        }
        result = { executed: 'fee_reminder', reminders_queued: rows.length, preview };
        break;
      }
      case 'generate_briefing': {
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        const cookie = req.headers.get('cookie') ?? '';
        const bRes = await fetch(`${baseUrl}/api/admin/principal-briefing/generate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookie }, body: '{}',
        }).catch(() => null);
        const bData = bRes ? await bRes.json().catch(() => ({})) as Record<string, unknown> : {};
        result = { executed: 'briefing', briefing_text: bData.briefing ?? bData.text ?? 'Briefing generated.', preview };
        break;
      }
      case 'run_risk_scan': {
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        const cookie = req.headers.get('cookie') ?? '';
        const rRes = await fetch(`${baseUrl}/api/admin/risk-flags/generate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookie }, body: '{}',
        }).catch(() => null);
        const rData = rRes ? await rRes.json().catch(() => ({})) as Record<string, unknown> : {};
        result = { executed: 'risk_scan', flagged: rData.flagged ?? rData.count ?? 0, preview };
        break;
      }
      case 'list_pending': {
        const [leaves, tcs, feeVerif, proofs] = await Promise.all([
          supabaseAdmin.from('teacher_leave_requests').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
          supabaseAdmin.from('transfer_certificates').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
          supabaseAdmin.from('fees').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending_verification'),
          supabaseAdmin.from('classroom_proofs').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
        ]);
        result = { executed: 'list', data: {
          leaves: leaves.count ?? 0, tcs: tcs.count ?? 0,
          fee_verifications: feeVerif.count ?? 0, proofs: proofs.count ?? 0,
        }, preview };
        break;
      }
      case 'summarise_today': {
        const [attResult, feeResult, incidentResult] = await Promise.all([
          supabaseAdmin.from('attendance').select('status').eq('school_id', schoolId).eq('date', today),
          supabaseAdmin.from('fees').select('amount').eq('school_id', schoolId).eq('paid_date', today).eq('status', 'paid'),
          supabaseAdmin.from('health_incidents').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('incident_date', today),
        ]);
        const attRows = attResult.data ?? [];
        const absent = attRows.filter(a => a.status === 'absent').length;
        const collected = (feeResult.data ?? []).reduce((s, f) => s + Number(f.amount), 0);
        result = { executed: 'summary', data: {
          absent, total: attRows.length,
          attendance_pct: attRows.length > 0 ? Math.round((1 - absent/attRows.length)*100) : null,
          fees_collected: collected, incidents: incidentResult.count ?? 0,
        }, preview };
        break;
      }
      default: {
        result = { executed: 'unknown', message: 'I didn\'t understand that instruction. Try: "Send a message to all parents", "Remind about overdue fees", "Generate today\'s briefing", "Show pending approvals"', preview: null };
      }
    }
  } catch (e) {
    console.error('[NLOps] Execute error:', String(e).slice(0, 200));
    result = { executed: 'error', error: 'Execution failed. Please try again.' };
  }

  // Step 3: Log to conversations
  try {
    await supabaseAdmin.from('conversations').insert({
      school_id: schoolId,
      direction: 'inbound',
      message: instruction,
      intent,
      response: JSON.stringify(result),
      session_id: `nl_ops_${staffId ?? 'admin'}`,
      metadata: { executed: result.executed, staff_id: staffId },
    });
  } catch { /* non-fatal: log failure silently */ }

  return NextResponse.json({ intent, preview, result, instruction });
}
