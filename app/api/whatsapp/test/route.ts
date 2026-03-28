// PATH: app/api/whatsapp/test/route.ts
//
// Simulates an incoming WhatsApp message for testing the bot without Twilio.
// Fetches parent data, detects intent, generates Claude reply — but does NOT
// send any real WhatsApp message. Returns the response for the UI preview.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { getSchoolId } from '@/lib/getSchoolId';
import { normalisePhone } from '@/lib/whatsapp';

type Intent = 'attendance' | 'fees' | 'events' | 'report' | 'ptm' | 'transport' | 'general' | 'stop' | 'start';

function detectIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (t === 'stop' || t === 'unsubscribe') return 'stop';
  if (t === 'start' || t === 'subscribe') return 'start';
  if (/attendance|present|absent|come.*school|school.*today/.test(t)) return 'attendance';
  if (/fee|fees|due|payment|paid|pending|overdue|amount/.test(t)) return 'fees';
  if (/event|holiday|exam|test|schedule|when|ptm|meeting/.test(t)) return 'events';
  if (/report|marks|grade|result|score|performance/.test(t)) return 'report';
  if (/bus|transport|route|pickup|drop/.test(t)) return 'transport';
  return 'general';
}

export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { phone, message } = await req.json() as { phone: string; message: string };

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message required' }, { status: 400 });
    }

    const normPhone = normalisePhone(phone) ?? phone;
    const intent = detectIntent(message);

    // Identify parent
    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('student_id, name, whatsapp_opted_out, school_id')
      .eq('phone', normPhone)
      .eq('school_id', schoolId)
      .maybeSingle();

    const { data: studentByPhone } = !parent ? await supabaseAdmin
      .from('students')
      .select('id, name, parent_name, phone_parent')
      .eq('phone_parent', normPhone)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .maybeSingle() : { data: null };

    const studentId = parent?.student_id ?? studentByPhone?.id ?? null;
    const parentName = parent?.name ?? studentByPhone?.parent_name ?? 'Parent';

    // Fetch school name
    const { data: school } = await supabaseAdmin
      .from('schools').select('name').eq('id', schoolId).single();
    const schoolName = school?.name ?? 'School OS';

    // Get student name
    let studentName = null;
    if (studentId) {
      const { data: s } = await supabaseAdmin
        .from('students').select('name, class, section').eq('id', studentId).single();
      studentName = s ? `${s.name} (Class ${s.class}-${s.section})` : null;
    }

    // Get live data context
    let dataContext = '';
    if (studentId && intent === 'attendance') {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const { data: att } = await supabaseAdmin
        .from('attendance').select('date, status')
        .eq('student_id', studentId).eq('school_id', schoolId)
        .gte('date', thirtyDaysAgo).order('date', { ascending: false }).limit(30);

      if (att && att.length > 0) {
        const todayRec = att.find(a => a.date === today);
        const present = att.filter(a => a.status === 'present').length;
        const pct = Math.round((present / att.length) * 100);
        dataContext = `Today: ${todayRec?.status ?? 'not marked'} | Last 30 days: ${present}/${att.length} (${pct}%)`;
      }
    } else if (studentId && intent === 'fees') {
      const { data: fees } = await supabaseAdmin
        .from('fees').select('fee_type, amount, due_date, status')
        .eq('student_id', studentId).eq('school_id', schoolId)
        .in('status', ['pending', 'overdue']);
      if (fees && fees.length > 0) {
        const total = fees.reduce((s, f) => s + Number(f.amount), 0);
        dataContext = `Pending: ₹${total.toLocaleString('en-IN')} across ${fees.length} item(s). Overdue: ${fees.filter(f => f.status === 'overdue').length}.`;
      } else {
        dataContext = 'No pending fees.';
      }
    }

    // Get knowledge context
    const { data: chunks } = await supabaseAdmin
      .from('knowledge_chunks').select('title, content')
      .eq('school_id', schoolId).eq('is_active', true)
      .in('category', intent === 'fees' ? ['fees'] : intent === 'events' ? ['events', 'schedule'] : intent === 'transport' ? ['transport'] : ['general'])
      .limit(3);
    const knowledgeCtx = (chunks ?? []).map(c => `${c.title}: ${c.content}`).join('\n');

    const systemPrompt = `You are the WhatsApp assistant for ${schoolName}. Reply in 3-5 sentences, plain text, no markdown. Address parent by name. Quote numbers if available. End: "Reply STOP to unsubscribe."`;
    const userMsg = `Parent: ${parentName}\nQuestion: "${message}"\nIntent: ${intent}\n${dataContext ? `Live data: ${dataContext}\n` : ''}${knowledgeCtx ? `Knowledge: ${knowledgeCtx}` : ''}`;

    let reply: string;
    try {
      reply = await callClaude(systemPrompt, userMsg, 200);
    } catch {
      reply = dataContext
        ? `Hi ${parentName}! ${dataContext}. For more info call ${schoolName} at 040-12345678. Reply STOP to unsubscribe.`
        : `Hi ${parentName}! Please contact ${schoolName} at 040-12345678 for assistance. Reply STOP to unsubscribe.`;
    }

    return NextResponse.json({
      success: true,
      phone: normPhone,
      intent,
      parent_name: parentName,
      student_name: studentName,
      data_context: dataContext || null,
      reply,
      note: 'Test mode — no WhatsApp message was sent',
    });

  } catch (err) {
    console.error('WhatsApp test error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
