import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task A: Parent complaint lifecycle endpoint.
//
// Auth model: phone + PIN re-auth per request — same pattern as other
// /api/parent/* routes (see app/api/parent/announcements/route.ts).
// Parents are not session-based; every request validates against parents table.
//
// POST { phone, pin, action: 'create' | 'list', ... }
//   action='create': create a new complaint. Auto-escalation for sensitive categories.
//   action='list':   return all complaints filed by this parent (full history).
//
// We expose both via POST (not GET) to keep phone+PIN out of URLs/logs.

export const runtime = 'nodejs';

const COMPLAINT_TYPES = [
  'academic','teacher_conduct','bullying','safety',
  'infrastructure','fee','transport','food','vendor','general',
] as const;
type ComplaintType = typeof COMPLAINT_TYPES[number];

// Categories that auto-start at status='escalated' (skip 'open').
const AUTO_ESCALATE: ReadonlySet<ComplaintType> = new Set([
  'bullying', 'safety', 'teacher_conduct',
]);

interface CreateBody {
  phone: string;
  pin: string;
  action: 'create';
  complaint_type: string;
  subject: string;
  description: string;
}

interface ListBody {
  phone: string;
  pin: string;
  action: 'list';
}

type Body = CreateBody | ListBody | { phone: string; pin: string; action?: undefined };

async function authParent(phone: string, pin: string) {
  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id, name, phone')
    .eq('phone', phone)
    .eq('access_pin', pin);

  if (error) return { ok: false, status: 500, error: 'Failed to verify credentials' } as const;
  if (!parents || parents.length === 0) {
    return { ok: false, status: 401, error: 'Invalid phone number or PIN' } as const;
  }
  if (parents.length > 1) {
    return { ok: false, status: 409, error: 'Multiple accounts match this phone. Please contact your school admin.' } as const;
  }
  return { ok: true as const, parent: parents[0] };
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json() as Body; } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.phone || !body.pin) {
    return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
  }

  const auth = await authParent(body.phone, body.pin);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { parent } = auth;

  // Default action is 'list' if not specified (parents reloading the tab).
  const action = body.action ?? 'list';

  // ─── LIST: return this parent's full complaint history ─────────────────────
  if (action === 'list') {
    const { data, error } = await supabaseAdmin
      .from('parent_complaints')
      .select('id, complaint_type, subject, description, status, resolution, created_at, updated_at, resolved_at, closed_at')
      .eq('school_id', parent.school_id)
      .eq('parent_phone', parent.phone)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Parent complaints list error:', error);
      return NextResponse.json({ error: 'Failed to load complaints' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total: data?.length ?? 0,
      complaints: data ?? [],
    });
  }

  // ─── CREATE: insert new complaint with auto-escalation ─────────────────────
  if (action === 'create') {
    const c = body as CreateBody;

    if (!c.complaint_type || !COMPLAINT_TYPES.includes(c.complaint_type as ComplaintType)) {
      return NextResponse.json({
        error: `complaint_type must be one of: ${COMPLAINT_TYPES.join(', ')}`,
      }, { status: 400 });
    }
    const subject = (c.subject ?? '').trim();
    const description = (c.description ?? '').trim();
    if (!subject) return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    if (subject.length > 200) return NextResponse.json({ error: 'subject must be 200 characters or fewer' }, { status: 400 });
    if (!description) return NextResponse.json({ error: 'description is required' }, { status: 400 });
    if (description.length > 4000) return NextResponse.json({ error: 'description must be 4000 characters or fewer' }, { status: 400 });

    const ctype = c.complaint_type as ComplaintType;
    const initialStatus = AUTO_ESCALATE.has(ctype) ? 'escalated' : 'open';

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('parent_complaints')
      .insert({
        school_id: parent.school_id,
        student_id: parent.student_id,
        parent_phone: parent.phone,
        complaint_type: ctype,
        subject,
        description,
        status: initialStatus,
      })
      .select('id, complaint_type, subject, description, status, created_at')
      .single();

    if (insErr || !inserted) {
      console.error('Parent complaint insert error:', insErr);
      return NextResponse.json({ error: 'Failed to file complaint' }, { status: 500 });
    }

    // Notify admins if auto-escalated. Best-effort — don't fail the request.
    if (initialStatus === 'escalated') {
      try {
        await supabaseAdmin.from('notifications').insert({
          school_id: parent.school_id,
          type: 'alert',
          title: `Escalated complaint filed: ${ctype}`,
          message: `Parent ${parent.name} filed a ${ctype} complaint: "${subject}". Auto-escalated due to sensitive category.`,
          channel: 'email',
          status: 'pending',
        });
      } catch (notifyErr) {
        console.warn('Complaint escalation notification queue failed:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      complaint: inserted,
      auto_escalated: initialStatus === 'escalated',
    });
  }

  return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
}
