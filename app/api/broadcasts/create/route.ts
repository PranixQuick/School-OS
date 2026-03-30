import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { callClaude } from '@/lib/claudeClient';
import { getSchoolId } from '@/lib/getSchoolId';
import { logActivity, logNotification } from '@/lib/logger';



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
    200,
    'claude-haiku-4-5-20251001'
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
    180,
    'claude-haiku-4-5-20251001'
  );
}

interface FeeRow {
  amount: number;
  due_date: string;
  fee_type: string;
  students: { name: string; parent_name: string }[] | null;
}

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);

  try {
    const body = await req.json() as {
      type: string;
      title: string;
      target_classes: string[];
      custom_message?: string;
      fee_type?: string;
      subject?: string;
      homework?: string;
      due_date?: string;
      teacher_name?: string;
    };

    let finalMessage = body.custom_message ?? '';

    if (!finalMessage) {
      if (body.type === 'fee_reminder') {
        const { data: feeData } = await supabaseAdmin
          .from('fees')
          .select('amount, due_date, fee_type, students(name, parent_name)')
          .eq('school_id', schoolId)
          .in('status', ['pending', 'overdue'])
          .limit(1);

        const sample = (feeData as unknown as FeeRow[] | null)?.[0];
        const studentArr = sample?.students;
        const student = Array.isArray(studentArr) ? studentArr[0] : null;

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

    let targetCount = 0;
    if (body.target_classes.length > 0) {
      const { count } = await supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .in('class', body.target_classes);
      targetCount = count ?? 0;
    }

    const { data, error } = await supabaseAdmin
      .from('broadcasts')
      .insert({
        school_id: schoolId,
        type: body.type,
        title: body.title,
        message: finalMessage,
        target_classes: body.target_classes,
        target_count: targetCount,
        sent_count: targetCount,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select('id, message, target_count, status')
      .single();

    if (error) throw new Error(error.message);

    // Log notification and activity (non-blocking)
    void logNotification({
      schoolId,
      type: body.type === 'fee_reminder' ? 'fee_reminder' : 'broadcast',
      title: body.title,
      message: finalMessage,
      targetCount,
      module: 'broadcasts',
      referenceId: data.id,
    });

    void logActivity({
      schoolId,
      action: `Sent ${body.type.replace('_', ' ')} broadcast "${body.title}" to ${targetCount} parents`,
      module: 'broadcasts',
      details: { type: body.type, classes: body.target_classes, count: targetCount },
    });

    return NextResponse.json({ success: true, broadcast: data });

  } catch (err) {
    console.error('Broadcast create error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
