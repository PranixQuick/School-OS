import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher accepts or declines a substitute assignment.
// Auth: phone+PIN per request.
// Body: { phone, pin, assignment_id, action: 'accept' | 'decline' }
// Initial state: 'pending' (set by /api/principal/substitute/assign).
// On accept: status='accepted', accepted_at=NOW()
// On decline: status='declined', accepted_at=NULL (preserves null)
//
// Authorization: assignment must belong to this teacher (substitute_staff_id = teacher.id)
// AND school_id must match teacher's school. Cross-tenant guarded.
// Idempotency: if already accepted/declined, returns 409 with current state.

interface RespondRequest {
  phone: string;
  pin: string;
  assignment_id: string;
  action: 'accept' | 'decline';
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const { phone, pin, assignment_id, action } = await req.json() as RespondRequest;

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!assignment_id || !UUID_RX.test(assignment_id)) {
      return NextResponse.json({ error: 'Valid assignment_id required' }, { status: 400 });
    }
    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: "action must be 'accept' or 'decline'" }, { status: 400 });
    }

    const { data: teacher, error: tErr } = await supabaseAdmin
      .from('staff')
      .select('id, school_id')
      .eq('phone', phone)
      .eq('access_pin', pin)
      .eq('is_active', true)
      .single();

    if (tErr || !teacher) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    // Guarded UPDATE: must match assignment_id, this teacher, this school, and status='assigned'.
    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const updates: Record<string, unknown> = { status: newStatus };
    if (action === 'accept') updates.accepted_at = new Date().toISOString();

    const { data: updated, error: uErr } = await supabaseAdmin
      .from('substitute_assignments')
      .update(updates)
      .eq('id', assignment_id)
      .eq('substitute_staff_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .eq('status', 'pending')  // idempotency: only respond from the 'pending' state (initial state per substitute_assignments status CHECK enum)
      .select('id, status, accepted_at')
      .maybeSingle();

    if (uErr) {
      console.error('Substitute respond UPDATE error:', uErr);
      return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
    }

    if (!updated) {
      // Either: assignment doesn't exist for this teacher, or already responded.
      // Check existing state for accurate 4xx.
      const { data: existing } = await supabaseAdmin
        .from('substitute_assignments')
        .select('id, status, accepted_at, substitute_staff_id, school_id')
        .eq('id', assignment_id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      }
      if (existing.substitute_staff_id !== teacher.id || existing.school_id !== teacher.school_id) {
        return NextResponse.json({ error: 'This assignment is not yours' }, { status: 403 });
      }
      // Must be already-responded.
      return NextResponse.json({
        error: `Assignment already responded (status: ${existing.status})`,
        existing_state: { status: existing.status, accepted_at: existing.accepted_at },
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      assignment_id: updated.id,
      status: updated.status,
      accepted_at: updated.accepted_at,
    });

  } catch (err) {
    console.error('Substitute respond error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
