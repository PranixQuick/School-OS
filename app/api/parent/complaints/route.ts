import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task A: Parent complaint submission and history.
// Auth: phone+PIN re-auth per request (same pattern as /api/parent/announcements).
// Auto-escalation: complaint_type IN (bullying, safety, teacher_conduct)
// starts at status='escalated' (skips 'open').
// On escalated insert, a notification row is created so admin/principal sees it.

const COMPLAINT_TYPES = [
  'academic','teacher_conduct','bullying','safety',
  'infrastructure','fee','transport','food','vendor','general',
] as const;

const ESCALATED_TYPES = new Set(['bullying', 'safety', 'teacher_conduct']);

type ComplaintType = typeof COMPLAINT_TYPES[number];

function isComplaintType(x: unknown): x is ComplaintType {
  return typeof x === 'string' && (COMPLAINT_TYPES as readonly string[]).includes(x);
}

// Verify the parent's phone+PIN against the parents table.
// Returns the matched parent row or null. Defensive against ambiguous matches
// (multiple parents with the same phone — surfaced as 409 by caller).
async function verifyParent(phone: string, pin: string): Promise<
  | { ok: true; parent: { id: string; school_id: string; student_id: string; phone: string; name: string | null } }
  | { ok: false; status: number; error: string }
> {
  const { data: parents, error } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id, phone, name')
    .eq('phone', phone)
    .eq('access_pin', pin);
  if (error) {
    console.error('[parent-complaints] parent lookup error:', error);
    return { ok: false, status: 500, error: 'Failed to verify credentials' };
  }
  if (!parents || parents.length === 0) {
    return { ok: false, status: 401, error: 'Invalid phone number or PIN' };
  }
  if (parents.length > 1) {
    return { ok: false, status: 409, error: 'Multiple accounts match this phone. Please contact your school admin.' };
  }
  return { ok: true, parent: parents[0] };
}

// POST /api/parent/complaints
// Body: { phone, pin, complaint_type, subject, description }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      phone?: string;
      pin?: string;
      complaint_type?: string;
      subject?: string;
      description?: string;
    };

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!body.complaint_type || !isComplaintType(body.complaint_type)) {
      return NextResponse.json({
        error: 'complaint_type must be one of: ' + COMPLAINT_TYPES.join(', '),
      }, { status: 400 });
    }
    const subject = (body.subject ?? '').trim();
    const description = (body.description ?? '').trim();
    if (!subject || subject.length > 200) {
      return NextResponse.json({ error: 'subject required (1-200 chars)' }, { status: 400 });
    }
    if (!description || description.length > 4000) {
      return NextResponse.json({ error: 'description required (1-4000 chars)' }, { status: 400 });
    }

    const auth = await verifyParent(body.phone, body.pin);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { parent } = auth;

    // Auto-escalate sensitive categories
    const initialStatus = ESCALATED_TYPES.has(body.complaint_type) ? 'escalated' : 'open';

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from('parent_complaints')
      .insert({
        school_id: parent.school_id,
        student_id: parent.student_id,
        parent_phone: parent.phone,
        complaint_type: body.complaint_type,
        subject,
        description,
        status: initialStatus,
      })
      .select('id, status, complaint_type, subject, created_at')
      .single();

    if (iErr || !inserted) {
      console.error('[parent-complaints] insert error:', iErr);
      return NextResponse.json({ error: 'Failed to file complaint' }, { status: 500 });
    }

    // Best-effort notification to admin/principal for escalated cases.
    // Failure here does not roll back the complaint — the complaint is the
    // authoritative record and admin will see it in the complaints list anyway.
    if (initialStatus === 'escalated') {
      try {
        await supabaseAdmin.from('notifications').insert({
          school_id: parent.school_id,
          type: 'alert',
          title: 'Escalated parent complaint: ' + body.complaint_type,
          message: 'A ' + body.complaint_type + ' complaint was filed by ' +
            (parent.name ?? 'a parent') + ' regarding "' + subject + '". Review immediately at /admin/complaints.',
          channel: 'email',
          status: 'pending',
          reference_id: inserted.id,
          module: 'parent_complaints',
        });
      } catch (notifErr) {
        console.error('[parent-complaints] escalation notification failed (non-fatal):', notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      complaint: inserted,
      escalated: initialStatus === 'escalated',
    }, { status: 201 });

  } catch (err) {
    console.error('[parent-complaints] POST error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET /api/parent/complaints — list this parent's own complaint history.
// Body via POST-style is awkward for GET; use query params + headers fallback.
// We accept both: ?phone=&pin= as query params (mobile-friendly bookmarks)
// OR a POST-style body. GET is mostly for the parent portal page which does:
//   fetch('/api/parent/complaints?phone=...&pin=...')
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get('phone') ?? '';
    const pin = url.searchParams.get('pin') ?? '';

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin query params required' }, { status: 400 });
    }

    const auth = await verifyParent(phone, pin);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { parent } = auth;

    // Parent sees only their own complaints (matched by school_id + parent_phone).
    const { data: rows, error } = await supabaseAdmin
      .from('parent_complaints')
      .select('id, complaint_type, subject, description, status, resolution, resolved_at, closed_at, created_at, updated_at')
      .eq('school_id', parent.school_id)
      .eq('parent_phone', parent.phone)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[parent-complaints] GET error:', error);
      return NextResponse.json({ error: 'Failed to load complaints' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total: rows?.length ?? 0,
      complaints: rows ?? [],
    });

  } catch (err) {
    console.error('[parent-complaints] GET error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
