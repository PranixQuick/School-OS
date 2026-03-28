// PATH: app/api/whatsapp/webhook/route.ts
// Enhanced: PTM slot booking, teacher attendance via WhatsApp, multilingual (EN/HI/TE)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { sendWhatsApp, normalisePhone } from '@/lib/whatsapp';

type Intent = 'attendance'|'fees'|'events'|'report'|'ptm'|'ptm_booking'|'transport'|'stop'|'start'|'teacher_attendance'|'general';
type Language = 'en'|'hi'|'te';

function detectLanguage(text: string): Language {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return 'en';
}

function detectIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (/^(stop|unsubscribe|opt.?out)$/.test(t)) return 'stop';
  if (/^(start|subscribe|yes|hi+|hey|hello)$/.test(t)) return 'start';
  // Teacher attendance: "Class 9B done", "9B done", "done 8A"
  if (/\b(class\s*)?[1-9][0-9]?[A-Ea-e]\s+(done|present|attendance|complete|marked)\b/.test(text)) return 'teacher_attendance';
  if (/\b(done|complete|marked)\s+(class\s*)?[1-9][0-9]?[A-Ea-e]\b/.test(text)) return 'teacher_attendance';
  // PTM slot reply: "1", "2", "slot 2"
  if (/^(slot\s*)?[1-5]$/.test(t)) return 'ptm_booking';
  if (/attendance|present|absent|did.*come|school.*today/.test(t)) return 'attendance';
  if (/fee|fees|due|payment|paid|pending|overdue|amount/.test(t)) return 'fees';
  if (/report|marks|grade|result|score|performance|progress/.test(t)) return 'report';
  if (/ptm|parent.*teacher|teacher.*meeting|appointment|slot|milna|meeting/.test(t)) return 'ptm';
  if (/event|holiday|exam|test|schedule|when|date|time/.test(t)) return 'events';
  if (/bus|transport|route|pickup|drop/.test(t)) return 'transport';
  return 'general';
}

async function getKnowledgeContext(schoolId: string, intent: Intent): Promise<string> {
  const map: Partial<Record<Intent, string[]>> = { fees: ['fees','general'], events: ['events','schedule','general'], ptm: ['events','schedule'], transport: ['transport'], report: ['general'], attendance: ['general'], general: ['general','contact'] };
  const cats = map[intent] ?? ['general'];
  const { data } = await supabaseAdmin.from('knowledge_chunks').select('title, content').eq('school_id', schoolId).eq('is_active', true).in('category', cats).limit(4);
  return data?.map(c => `${c.title}: ${c.content}`).join('\n\n') ?? '';
}

async function getStaffByPhone(phone: string, schoolId: string) {
  const { data } = await supabaseAdmin.from('staff').select('id, name, role, phone').eq('phone', phone).eq('school_id', schoolId).eq('is_active', true).maybeSingle();
  return data;
}

async function handleTeacherAttendance(text: string, staffId: string|null, schoolId: string, staffName: string): Promise<string> {
  const match = text.match(/\b([1-9][0-9]?)\s*([A-Ea-e])\b/);
  if (!match) return `Hi ${staffName}! Format: "Class 9B done". I couldn't find the class in your message.`;
  const classNum = match[1]; const section = match[2].toUpperCase();
  const today = new Date().toISOString().split('T')[0];
  const { data: students, error } = await supabaseAdmin.from('students').select('id').eq('school_id', schoolId).eq('class', classNum).eq('section', section).eq('is_active', true);
  if (error || !students?.length) return `Hi ${staffName}! Class ${classNum}${section} not found. Check the class name and try again.`;
  await supabaseAdmin.from('attendance').upsert(
    students.map(s => ({ school_id: schoolId, student_id: s.id, date: today, status: 'present', marked_by: staffId ?? 'whatsapp', marked_via: 'whatsapp', data_source: 'manual' })),
    { onConflict: 'school_id,student_id,date', ignoreDuplicates: false }
  );
  if (staffId) await supabaseAdmin.from('teacher_attendance').upsert({ school_id: schoolId, staff_id: staffId, date: today, status: 'present', marked_via: 'whatsapp' }, { onConflict: 'school_id,staff_id,date', ignoreDuplicates: true }).then(null, () => {});
  return `✅ Done! Class ${classNum}${section}: ${students.length} students marked Present for ${today}. Thank you, ${staffName}!`;
}

async function getAvailablePTMSlots(schoolId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data: sessions } = await supabaseAdmin.from('ptm_sessions').select('id, title, date, start_time, end_time').eq('school_id', schoolId).eq('status', 'scheduled').gte('date', today).order('date').limit(1);
  if (!sessions?.length) return null;
  const { data: slots } = await supabaseAdmin.from('ptm_slots').select('id, slot_time, status, staff(name)').eq('school_id', schoolId).eq('session_id', sessions[0].id as string).eq('status', 'available').order('slot_time').limit(5);
  if (!slots?.length) return null;
  return { session: sessions[0], slots };
}

async function bookPTMSlot(slotIndex: number, studentId: string, schoolId: string, parentName: string): Promise<string> {
  const ptmData = await getAvailablePTMSlots(schoolId);
  if (!ptmData) return 'No PTM slots currently available. Please contact the school office.';
  const slot = ptmData.slots[slotIndex - 1];
  if (!slot) return `Slot ${slotIndex} is not valid. Please choose a number from the available list.`;
  const { error } = await supabaseAdmin.from('ptm_slots').update({ status: 'booked', student_id: studentId, parent_confirmed: true }).eq('id', slot.id).eq('school_id', schoolId);
  if (error) return 'Unable to book slot. Please call the school office.';
  const slotTime = (slot.slot_time as string).substring(0, 5);
  const teacher = (slot.staff as { name?: string }|null)?.name ?? 'your child\'s teacher';
  return `✅ PTM Confirmed!\n\n${parentName}, your meeting with ${teacher} is booked:\n📅 ${slotTime}\n\nPlease arrive 5 minutes early.`;
}

async function buildParentResponse(params: { intent: Intent; studentId: string|null; schoolId: string; schoolName: string; parentName: string; incomingText: string; language: Language; }): Promise<string> {
  const { intent, studentId, schoolId, schoolName, parentName, language } = params;

  if (intent === 'stop') return `You have been unsubscribed from ${schoolName} notifications. Reply START to re-subscribe.`;
  if (intent === 'start') return `Welcome! You are subscribed to ${schoolName} notifications. Send "attendance", "fees", "events", or "PTM" for updates.`;

  if (intent === 'ptm_booking' && studentId) {
    const num = parseInt(params.incomingText.replace(/\D/g, '')) || 1;
    return bookPTMSlot(num, studentId, schoolId, parentName);
  }

  if (intent === 'ptm') {
    const ptm = await getAvailablePTMSlots(schoolId);
    if (!ptm) return `Hi ${parentName}! No PTM sessions scheduled currently. Contact ${schoolName} for more info.`;
    const dateStr = new Date(ptm.session.date as string).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const slotList = ptm.slots.map((s, i) => `${i+1}. ${(s.slot_time as string).substring(0, 5)} — ${(s.staff as {name?:string}|null)?.name ?? 'Teacher'}`).join('\n');
    return `Hi ${parentName}! PTM is on ${dateStr}.\n\nAvailable slots:\n${slotList}\n\nReply with slot number to book (e.g., "1").`;
  }

  const ctx = await getKnowledgeContext(schoolId, intent);
  let data = '';

  if (studentId) {
    const { data: s } = await supabaseAdmin.from('students').select('name, class, section').eq('id', studentId).eq('school_id', schoolId).single();
    if (intent === 'attendance') {
      const thirtyDaysAgo = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const { data: att } = await supabaseAdmin.from('attendance').select('date, status').eq('student_id', studentId).eq('school_id', schoolId).gte('date', thirtyDaysAgo).order('date', { ascending: false }).limit(30);
      if (att?.length) {
        const present = att.filter(r => r.status === 'present').length;
        const todayAtt = att.find(r => r.date === today);
        data = `Student: ${s?.name} (Class ${s?.class}-${s?.section})\nToday: ${todayAtt?.status?.toUpperCase() ?? 'NOT MARKED'}\nLast 30 days: ${present}/${att.length} (${Math.round(present/att.length*100)}%)`;
      } else data = `Student: ${s?.name}. No attendance records found.`;
    } else if (intent === 'fees') {
      const { data: fees } = await supabaseAdmin.from('fees').select('fee_type, amount, due_date, status').eq('student_id', studentId).eq('school_id', schoolId).in('status', ['pending','overdue']).order('due_date', { ascending: true });
      if (fees?.length) {
        const total = fees.reduce((acc, f) => acc + Number(f.amount), 0);
        data = `Student: ${s?.name}\nPending: ₹${total.toLocaleString('en-IN')} (${fees.length} item(s))\n${fees.filter(f=>f.status==='overdue').length > 0 ? `⚠️ ${fees.filter(f=>f.status==='overdue').length} overdue` : ''}\nNext: ${fees[0].fee_type} ₹${Number(fees[0].amount).toLocaleString('en-IN')} by ${fees[0].due_date}`;
      } else data = `Student: ${s?.name}. No pending fees!`;
    } else if (intent === 'report') {
      const { data: n } = await supabaseAdmin.from('report_narratives').select('term, narrative_text').eq('student_id', studentId).eq('school_id', schoolId).in('status', ['draft','approved']).order('generated_at', { ascending: false }).limit(1).maybeSingle();
      data = n ? `Student: ${s?.name}\nReport (${n.term}): ${n.narrative_text.slice(0, 200)}` : `Student: ${s?.name}. Report not yet generated.`;
    }
  }

  const langMap: Record<Language, string> = { en: 'Reply in English.', hi: 'Reply in simple Hindi (Devanagari script).', te: 'Reply in simple Telugu (Telugu script).' };

  const sys = `You are the WhatsApp assistant for ${schoolName}. Help parents with school info. Be concise (3-5 sentences). ${langMap[language]} Address parent by name. No markdown or bullet points. End with "Reply STOP to unsubscribe."`;
  const usr = `Parent: ${parentName}\nQuestion: "${params.incomingText}"\nIntent: ${intent}\n\n${data ? `DATA:\n${data}\n\n` : ''}${ctx ? `SCHOOL INFO:\n${ctx}` : ''}`;

  try { return await callClaude(sys, usr, 200); }
  catch { return `Hi ${parentName}! ${data || `Please contact ${schoolName} for assistance.`} Reply STOP to unsubscribe.`; }
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const rawFrom = params.get('From') ?? '';
    const body = (params.get('Body') ?? '').trim();
    const messageSid = params.get('MessageSid') ?? '';

    if (!rawFrom || !body) return new NextResponse('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });

    const fromPhone = rawFrom.replace('whatsapp:', '');
    const normPhone = normalisePhone(fromPhone) ?? fromPhone;
    const language = detectLanguage(body);
    const intent = detectIntent(body);

    // Resolve school and identity
    const { data: parentRecord } = await supabaseAdmin.from('parents').select('school_id, name, student_id, whatsapp_opted_out').eq('phone', normPhone).limit(1).maybeSingle();
    const { data: studentRecord } = !parentRecord ? await supabaseAdmin.from('students').select('id, name, parent_name, school_id, phone_parent').eq('phone_parent', normPhone).eq('is_active', true).limit(1).maybeSingle() : { data: null };

    const schoolId = parentRecord?.school_id ?? studentRecord?.school_id ?? '00000000-0000-0000-0000-000000000001';
    const studentId = parentRecord?.student_id ?? studentRecord?.id ?? null;
    const parentName = parentRecord?.name ?? studentRecord?.parent_name ?? 'Parent';
    const optedOut = parentRecord?.whatsapp_opted_out ?? false;

    const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', schoolId).single();
    const schoolName = school?.name ?? 'School';

    let replyText: string;

    if (intent === 'teacher_attendance') {
      const staff = await getStaffByPhone(normPhone, schoolId);
      replyText = staff
        ? await handleTeacherAttendance(body, staff.id as string, schoolId, staff.name as string)
        : await buildParentResponse({ intent: 'general', studentId, schoolId, schoolName, parentName, incomingText: body, language });
    } else {
      if (intent === 'stop' && parentRecord) await supabaseAdmin.from('parents').update({ whatsapp_opted_out: true, opted_out_at: new Date().toISOString() }).eq('school_id', schoolId).eq('phone', normPhone);
      if (intent === 'start' && parentRecord) await supabaseAdmin.from('parents').update({ whatsapp_opted_out: false, opted_out_at: null }).eq('school_id', schoolId).eq('phone', normPhone);
      if (optedOut && intent !== 'start') return new NextResponse('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
      replyText = await buildParentResponse({ intent, studentId, schoolId, schoolName, parentName, incomingText: body, language });
    }

    // Log to conversations
    await supabaseAdmin.from('conversations').insert({ school_id: schoolId, student_id: studentId, phone_number: normPhone, direction: 'inbound', message: body, response: replyText, intent: intent as string, language, session_id: messageSid, metadata: { from_raw: rawFrom, message_sid: messageSid } }).then(null, () => {});

    await sendWhatsApp({ to: normPhone, body: replyText, schoolName });

    return new NextResponse('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('[WhatsApp webhook]', err);
    return new NextResponse('<Response></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', features: ['parent-bot', 'ptm-booking', 'teacher-attendance', 'multilingual-en-hi-te'] });
}
