import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

async function generateFeeReminderMessage(params: {
  studentName: string;
  parentName: string;
  amount: number;
  dueDate: string;
  feeType: string;
}): Promise<string> {
  return callClaude(
    `You are a school admin assistant. Write a polite, concise WhatsApp fee reminder message.
Keep it under 100 words. Warm but firm. End with school contact.
Return only the message text, no quotes.`,
    `Student: ${params.studentName}, Parent: ${params.parentName}
Fee type: ${params.feeType}, Amount: ₹${params.amount}, Due date: ${params.dueDate}
School: Suchitra Academy, Hyderabad. Contact: 040-12345678`,
    200
  );
}

async function generateHomeworkMessage(params: {
  className: string;
  subject: string;
  homework: string;
  dueDate: string;
  teacherName: string;
}): Promise<string> {
  return callClaude(
    `You are a school teacher. Write a brief WhatsApp homework broadcast for parents.
Under 80 words. Friendly and clear. Return only the message text.`,
    `Class: ${params.className}, Subject: ${params.subject}
Homework: ${params.homework}
Due: ${params.dueDate}, Teacher: ${params.teacherName}`,
    180
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      type: string;
      title: string;
      target_classes: string[];
      custom_message?: string;
      // Fee reminder specific
      fee_type?: string;
      // Homework specific
      subject?: string;
      homework?: string;
      due_date?: string;
      teacher_name?: string;
    };

    let finalMessage = body.custom_message ?? '';

    // AI-generate message if not provided
    if (!finalMessage) {
      if (body.type === 'fee_reminder') {
        // Get pending fees for target classes
        const { data: feeData } = await supabaseAdmin
          .from('fees')
          .select('amount, due_date, fee_type, students(name, parent_name)')
          .eq('school_id', SCHOOL_ID)
          .in('status', ['pending', 'overdue'])
          .limit(1);

        const sample = feeData?.[0];
        const student = sample?.students as { name: string; parent_name: string } | null;
        finalMessage = await generateFeeReminderMessage({
          studentName: student?.name ?? 'Student',
          parentName: student?.parent_name ?? 'Parent',
          amount: Number(sample?.amount ?? 0),
          dueDate: sample?.due_date ?? body.due_date ?? 'this month',
          feeType: sample?.fee_type ?? body.fee_type ?? 'tuition',
        });
      } else if (body.type === 'homework') {
        finalMessage = await generateHomeworkMessage({
          className: body.target_classes.join(', '),
          subject: body.subject ?? 'General',
          homework: body.homework ?? body.title,
          dueDate: body.due_date ?? 'tomorrow',
          teacherName: body.teacher_name ?? 'Teacher',
        });
      } else {
        finalMessage = body.title;
      }
    }

    // Count targets
    let targetCount = 0;
    if (body.target_classes.length > 0) {
      const { count } = await supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', SCHOOL_ID)
        .eq('is_active', true)
        .in('class', body.target_classes);
      targetCount = count ?? 0;
    }

    const { data, error } = await supabaseAdmin
      .from('broadcasts')
      .insert({
        school_id: SCHOOL_ID,
        type: body.type,
        title: body.title,
        message: finalMessage,
        target_classes: body.target_classes,
        target_count: targetCount,
        sent_count: targetCount, // Simulate sent (no actual WhatsApp in Phase 2)
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select('id, message, target_count, status')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, broadcast: data });
  } catch (err) {
    console.error('Broadcast create error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
