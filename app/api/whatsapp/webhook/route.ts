// PATH: app/api/whatsapp/webhook/route.ts
//
// Twilio WhatsApp incoming message handler.
// Twilio sends POST with form-encoded body: From, Body, MessageSid, etc.
// We immediately return 200 + TwiML, then process async.
//
// To connect: set your Twilio WhatsApp sandbox webhook to:
//   https://your-school-os.vercel.app/api/whatsapp/webhook
// Method: HTTP POST

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { sendWhatsApp, normalisePhone } from '@/lib/whatsapp';

// ─── Intent detection ─────────────────────────────────────────────────────────

type Intent =
  | 'attendance'
  | 'fees'
  | 'events'
  | 'report'
  | 'ptm'
  | 'transport'
  | 'stop'
  | 'start'
  | 'general';

function detectIntent(text: string): Intent {
  const t = text.toLowerCase().trim();

  if (t === 'stop' || t === 'unsubscribe' || t === 'opt out') return 'stop';
  if (t === 'start' || t === 'subscribe' || t === 'yes') return 'start';

  if (/attendance|present|absent|did.*come|school.*today|today.*school/.test(t)) return 'attendance';
  if (/fee|fees|due|payment|paid|pending|overdue|amount/.test(t)) return 'fees';
  if (/event|holiday|exam|test|schedule|when|date|time|ptm|meeting/.test(t)) return 'events';
  if (/report|marks|grade|result|score|performance|progress/.test(t)) return 'report';
  if (/ptm|parent.*teacher|teacher.*meeting|appointment|slot/.test(t)) return 'ptm';
  if (/bus|transport|route|pickup|drop/.test(t)) return 'transport';

  return 'general';
}

// ─── Knowledge base lookup ─────────────────────────────────────────────────────

async function getKnowledgeContext(schoolId: string, intent: Intent): Promise<string> {
  const categoryMap: Record<Intent, string[]> = {
    fees: ['fees', 'general'],
    events: ['events', 'schedule', 'general'],
    ptm: ['events', 'schedule'],
    transport: ['transport'],
    report: ['general', 'curriculum'],
    attendance: ['general'],
    general: ['general', 'contact'],
    stop: [],
    start: [],
  };

  const categories = categoryMap[intent] ?? ['general'];

  const { data } = await supabaseAdmin
    .from('knowledge_chunks')
    .select('title, content')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .in('category', categories)
    .limit(4);

  if (!data || data.length === 0) return '';
  return data.map(c => `${c.title}: ${c.content}`).join('\n\n');
}

// ─── Student data fetchers ────────────────────────────────────────────────────

async function getStudentByPhone(phone: string, schoolId: string) {
  // Look up via parents table first
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('student_id, name, whatsapp_opted_out')
    .eq('phone', phone)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (parent) return { studentId: parent.student_id, parentName: parent.name, optedOut: parent.whatsapp_opted_out ?? false };

  // Fallback: check students.phone_parent
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name, parent_name, phone_parent')
    .eq('phone_parent', phone)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle();

  if (student) return { studentId: student.id, parentName: student.parent_name ?? 'Parent', optedOut: false };

  return null;
}

async function getAttendanceSummary(studentId: string, schoolId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const { data: records } = await supabaseAdmin
    .from('attendance')
    .select('date, status')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .gte('date', thirtyDaysAgo)
    .order('date', { ascending: false })
    .limit(30);

  if (!records || records.length === 0) return null;

  const todayRecord = records.find(r => r.date === today);
  const present = records.filter(r => r.status === 'present').length;
  const pct = Math.round((present / records.length) * 100);

  return {
    todayStatus: todayRecord?.status ?? 'not marked',
    present,
    total: records.length,
    percentage: pct,
  };
}

async function getFeeStatus(studentId: string, schoolId: string) {
  const { data: fees } = await supabaseAdmin
    .from('fees')
    .select('fee_type, amount, due_date, status')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true });

  if (!fees || fees.length === 0) return null;

  const totalPending = fees.reduce((s, f) => s + Number(f.amount), 0);
  const overdue = fees.filter(f => f.status === 'overdue');

  return {
    pendingCount: fees.length,
    totalAmount: totalPending,
    overdueCount: overdue.length,
    nextDue: fees[0],
  };
}

async function getStudentInfo(studentId: string, schoolId: string) {
  const { data } = await supabaseAdmin
    .from('students')
    .select('name, class, section, roll_number')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .single();
  return data;
}

// ─── Response builders ────────────────────────────────────────────────────────

async function buildResponse(params: {
  intent: Intent;
  studentId: string | null;
  schoolId: string;
  schoolName: string;
  parentName: string;
  incomingText: string;
}): Promise<string> {
  const { intent, studentId, schoolId, schoolName, parentName } = params;

  // Opt-out / opt-in — no Claude needed
  if (intent === 'stop') {
    return `You have been unsubscribed from ${schoolName} WhatsApp notifications. Reply START to re-subscribe.`;
  }
  if (intent === 'start') {
    return `Welcome back! You are now subscribed to ${schoolName} notifications. Send "attendance", "fees", or "events" to get updates.`;
  }

  // Get knowledge base context
  const knowledgeCtx = await getKnowledgeContext(schoolId, intent);

  // Get live student data if we have a student
  let dataContext = '';

  if (studentId) {
    const student = await getStudentInfo(studentId, schoolId);

    if (intent === 'attendance') {
      const att = await getAttendanceSummary(studentId, schoolId);
      if (att) {
        dataContext = `Student: ${student?.name} (Class ${student?.class}-${student?.section})
Today's attendance: ${att.todayStatus.toUpperCase()}
Last 30 days: ${att.present}/${att.total} days present (${att.percentage}%)`;
      } else {
        dataContext = `Student: ${student?.name}. No attendance records found for the last 30 days.`;
      }
    } else if (intent === 'fees') {
      const fees = await getFeeStatus(studentId, schoolId);
      if (fees) {
        dataContext = `Student: ${student?.name}
Pending fees: ₹${fees.totalAmount.toLocaleString('en-IN')} across ${fees.pendingCount} item(s)
${fees.overdueCount > 0 ? `⚠️ ${fees.overdueCount} overdue` : ''}
Next due: ${fees.nextDue.fee_type} – ₹${Number(fees.nextDue.amount).toLocaleString('en-IN')} by ${fees.nextDue.due_date}`;
      } else {
        dataContext = `Student: ${student?.name}. No pending fees. All dues cleared!`;
      }
    } else if (intent === 'report') {
      const { data: narrative } = await supabaseAdmin
        .from('report_narratives')
        .select('term, narrative_text, status')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('status', 'final')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (narrative) {
        dataContext = `Student: ${student?.name}
Latest report (${narrative.term}): ${narrative.narrative_text.slice(0, 300)}`;
      } else {
        dataContext = `Student: ${student?.name}. Report card not yet generated for the current term.`;
      }
    }
  }

  // Build Claude prompt
  const systemPrompt = `You are the WhatsApp assistant for ${schoolName}, an Indian school.
You help parents with information about their child's attendance, fees, events, and school updates.
Rules:
- Reply in 3-5 sentences maximum. WhatsApp messages must be concise.
- Be warm and professional. Use simple English.
- Always address the parent by name.
- If data is available, quote specific numbers.
- If information is unavailable, say so and provide the school contact: 040-12345678.
- Never make up information you don't have.
- End with: "Reply STOP to unsubscribe."`;

  const userMsg = `Parent name: ${parentName}
Parent's question: "${params.incomingText}"
Intent detected: ${intent}

${dataContext ? `LIVE DATA:\n${dataContext}\n` : ''}
${knowledgeCtx ? `SCHOOL KNOWLEDGE BASE:\n${knowledgeCtx}` : ''}

Generate a helpful, concise WhatsApp reply. Do not use markdown. No bullet points. Plain text only.`;

  try {
    return await callClaude(systemPrompt, userMsg, 200);
  } catch {
    // Fallback if Claude fails
    if (dataContext) return `Hi ${parentName}! ${dataContext}\n\nFor more info call us at 040-12345678. Reply STOP to unsubscribe.`;
    return `Hi ${parentName}! Please contact ${schoolName} at 040-12345678 for assistance. Reply STOP to unsubscribe.`;
  }
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Twilio sends form-encoded data
    const text = await req.text();
    const params = new URLSearchParams(text);

    const rawFrom = params.get('From') ?? '';          // e.g. whatsapp:+919876543210
    const body = (params.get('Body') ?? '').trim();
    const messageSid = params.get('MessageSid') ?? '';

    if (!rawFrom || !body) {
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Normalise phone: strip "whatsapp:" prefix
    const fromPhone = rawFrom.replace('whatsapp:', '');
    const normPhone = normalisePhone(fromPhone) ?? fromPhone;

    // For now, find school by phone lookup (multi-tenant: first matching school)
    // In production, you'd use a Twilio number → school mapping
    const { data: parentRecord } = await supabaseAdmin
      .from('parents')
      .select('school_id, name, student_id, whatsapp_opted_out')
      .eq('phone', normPhone)
      .limit(1)
      .maybeSingle();

    // Also try students.phone_parent
    const { data: studentRecord } = !parentRecord ? await supabaseAdmin
      .from('students')
      .select('id, name, parent_name, school_id, phone_parent')
      .eq('phone_parent', normPhone)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle() : { data: null };

    const schoolId = parentRecord?.school_id ?? studentRecord?.school_id ?? '00000000-0000-0000-0000-000000000001';
    const studentId = parentRecord?.student_id ?? studentRecord?.id ?? null;
    const parentName = parentRecord?.name ?? studentRecord?.parent_name ?? 'Parent';
    const optedOut = parentRecord?.whatsapp_opted_out ?? false;

    // Fetch school name
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single();
    const schoolName = school?.name ?? 'School OS';

    const intent = detectIntent(body);

    // Handle opt-out immediately
    if (intent === 'stop' && parentRecord) {
      await supabaseAdmin.from('parents').update({
        whatsapp_opted_out: true,
        opted_out_at: new Date().toISOString(),
      }).eq('school_id', schoolId).eq('phone', normPhone);
    }
    if (intent === 'start' && parentRecord) {
      await supabaseAdmin.from('parents').update({
        whatsapp_opted_out: false,
        opted_out_at: null,
      }).eq('school_id', schoolId).eq('phone', normPhone);
    }

    // If opted out and not trying to re-subscribe, silently ignore
    if (optedOut && intent !== 'start') {
      return new NextResponse('<Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Log incoming message
    const conversationId = await supabaseAdmin
      .from('conversations')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        phone_number: normPhone,
        direction: 'inbound',
        message: body,
        intent,
        language: 'en',
        session_id: messageSid,
        metadata: { from_raw: rawFrom, message_sid: messageSid },
      })
      .select('id')
      .single()
      .then(r => r.data?.id ?? null);

    // Generate response asynchronously — send immediate ack first
    // Twilio TwiML immediate response (blank = no immediate reply)
    // We'll send the reply via Twilio API after generating

    // Generate and send reply
    const replyText = await buildResponse({
      intent,
      studentId,
      schoolId,
      schoolName,
      parentName,
      incomingText: body,
    });

    // Log outbound response
    if (conversationId) {
      await supabaseAdmin.from('conversations').update({
        response: replyText,
      }).eq('id', conversationId);
    }

    // Send reply via WhatsApp (via sendWhatsApp — Twilio or stub)
    await sendWhatsApp({ to: normPhone, body: replyText, schoolName });

    // Return TwiML (blank — we already sent via REST API above)
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (err) {
    console.error('[WhatsApp webhook error]', err);
    // Always return 200 to Twilio to prevent retries
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

// Twilio webhook validation requires POST — also handle GET for health check
export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook active', method: 'POST' });
}
