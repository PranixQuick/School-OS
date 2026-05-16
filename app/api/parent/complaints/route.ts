import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task A: Parent complaint create + history.
// Auth pattern: phone+PIN re-auth per request (matches /api/parent/announcements,
// /api/parent/student). No session cookie.
//
// POST body: { phone, pin, complaint_type, subject, description, student_id? }
//   - complaint_type must be one of the 10 enum values
//   - subject 1-200 chars, description 1-4000 chars
//   - student_id optional: defaults to parent.student_id
//   - auto-escalation: bullying / safety / teacher_conduct → status='escalated' on insert
//
// GET (via POST with action='list'): { phone, pin, limit?, status? }
//   - returns parent's own complaint history, ordered by created_at DESC
//   - limit defaults 20, max 100
//   - optional status filter

export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set([
  'academic', 'teacher_conduct', 'bullying', 'safety',
  'infrastructure', 'fee', 'transport', 'food', 'vendor', 'general',
]);

const ALLOWED_STATUSES = new Set([
  'open', 'under_review', 'escalated', 'resolved', 'closed',
]);

const AUTO_ESCALATE_TYPES = new Set(['bullying', 'safety', 'teacher_conduct']);

interface CreateBody {
  phone?: string;
  pin?: string;
  action?: 'create' | 'list';
  complaint_type?: string;
  subject?: string;
  description?: string;
  student_id?: string;
  limit?: number;
  status?: string;
}

// Verify parent identity by phone+PIN match. Returns parent row or throws.
async function verifyParent(phone: string, pin: string) {
  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id, name, phone')
    .eq('phone', phone)
    .eq('access_pin', pin);
  if (error) throw new Error(`Parent lookup failed: ${error.message}`);
  if (!parents || parents.length === 0) return null;
  if (parents.length > 1) throw new Error('Multiple accounts match this phone');
  return parents[0];
}

export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.phone || !body.pin) {
    return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
  }

  let parent;
  try {
    parent = await verifyParent(body.phone, body.pin);
  } catch (e) {
    if (String(e).includes('Multiple accounts')) {
      return NextResponse.json({ error: String(e) }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 });
  }
  if (!parent) {
    return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
  }

  const action = body.action ?? 'create';

  // ─── GET history ───────────────────────────────────────────────────────────
  if (action === 'list') {
    const limit = Math.min(Math.max(body.limit ?? 20, 1), 100);

    let q = supabaseAdmin
      .from('parent_complaints')
      .select('id, complaint_type, subject, description, status, assigned_to, resolution, resolved_at, closed_at, created_at, updated_at, student_id')
      .eq('school_id', parent.school_id)
      .eq('parent_phone', parent.phone)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (body.status && ALLOWED_STATUSES.has(body.status)) {
      q = q.eq('status', body.status);
    }

    const { data, error } = await q;
    if (error) {
      console.error('Complaint list error:', error);
      return NextResponse.json({ error: 'Failed to load complaints' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total: data?.length ?? 0,
      complaints: data ?? [],
    });
  }

  // ─── POST create ───────────────────────────────────────────────────────────

  const complaintType = body.complaint_type?.trim();
  const subject = body.subject?.trim();
  const description = body.description?.trim();

  if (!complaintType || !ALLOWED_TYPES.has(complaintType)) {
    return NextResponse.json({
      error: 'complaint_type must be one of: academic, teacher_conduct, bullying, safety, infrastructure, fee, transport, food, vendor, general',
    }, { status: 400 });
  }
  if (!subject || subject.length < 1 || subject.length > 200) {
    return NextResponse.json({ error: 'subject required (1-200 characters)' }, { status: 400 });
  }
  if (!description || description.length < 1 || description.length > 4000) {
    return NextResponse.json({ error: 'description required (1-4000 characters)' }, { status: 400 });
  }

  // student_id defaults to parent's linked student; if provided, must match same school
  let studentId = body.student_id?.trim() || parent.student_id;
  if (body.student_id && body.student_id !== parent.student_id) {
    const { data: studentCheck } = await supabaseAdmin
      .from('students')
      .select('id, school_id')
      .eq('id', body.student_id)
      .eq('school_id', parent.school_id)
      .maybeSingle();
    if (!studentCheck) {
      return NextResponse.json({ error: 'student_id does not belong to this parent\'s school' }, { status: 403 });
    }
    studentId = studentCheck.id;
  }

  // Auto-escalation
  const initialStatus = AUTO_ESCALATE_TYPES.has(complaintType) ? 'escalated' : 'open';

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('parent_complaints')
    .insert({
      school_id: parent.school_id,
      student_id: studentId,
      parent_phone: parent.phone,
      complaint_type: complaintType,
      subject,
      description,
      status: initialStatus,
    })
    .select('id, complaint_type, subject, description, status, created_at')
    .single();

  if (insertErr || !inserted) {
    console.error('Complaint insert error:', insertErr);
    return NextResponse.json({ error: 'Failed to file complaint' }, { status: 500 });
  }

  // Best-effort: notify school admins about an escalated complaint via notifications table.
  // Doesn't block on failure — the complaint is already filed.
  if (initialStatus === 'escalated') {
    try {
      await supabaseAdmin.from('notifications').insert({
        school_id: parent.school_id,
        type: 'alert',
        title: `Escalated complaint: ${complaintType}`,
        message: `A parent has filed a complaint requiring immediate attention. Subject: ${subject.slice(0, 100)}. View in admin → Parent Complaints.`,
        channel: 'email',
        status: 'pending',
      });
    } catch (notifyErr) {
      // Log but don't fail the complaint creation
      console.error('Failed to queue escalation notification:', notifyErr);
    }
  }

  return NextResponse.json({
    success: true,
    complaint: inserted,
    auto_escalated: initialStatus === 'escalated',
  });
}
