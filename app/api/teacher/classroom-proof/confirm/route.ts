import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher confirms a successful classroom proof upload, creating the DB row.
// Auth: phone+PIN per request.
// Body: { phone, pin, storage_path, class_id, period_id?, taken_at, geo_lat?, geo_lng? }
//
// This route is called AFTER the client successfully uploads to the signed URL.
// It writes the classroom_proofs row pointing at the storage_path.
//
// Authorization re-checks (defense in depth):
//   - Teacher exists, active
//   - storage_path begins with <school_id>/<staff_id>/ — prevents writing rows for
//     paths the teacher doesn't own (even though the upload would have failed RLS,
//     a malicious confirm with an arbitrary path would create dangling DB rows)
//   - class_id corresponds to a timetable row for this teacher (mirrors upload-url
//     authorization)
//   - period_id, if given, must match the timetable row for this teacher+class

interface ConfirmRequest {
  phone: string;
  pin: string;
  storage_path: string;
  class_id: string;
  period_id?: string;
  taken_at?: string;
  geo_lat?: number;
  geo_lng?: number;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ConfirmRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!body.storage_path || typeof body.storage_path !== 'string' || body.storage_path.length > 500) {
      return NextResponse.json({ error: 'Valid storage_path required' }, { status: 400 });
    }
    if (!body.class_id || !UUID_RX.test(body.class_id)) {
      return NextResponse.json({ error: 'Valid class_id required' }, { status: 400 });
    }
    if (body.period_id && !UUID_RX.test(body.period_id)) {
      return NextResponse.json({ error: 'Invalid period_id format' }, { status: 400 });
    }
    if (body.geo_lat !== undefined && (typeof body.geo_lat !== 'number' || body.geo_lat < -90 || body.geo_lat > 90)) {
      return NextResponse.json({ error: 'geo_lat out of range' }, { status: 400 });
    }
    if (body.geo_lng !== undefined && (typeof body.geo_lng !== 'number' || body.geo_lng < -180 || body.geo_lng > 180)) {
      return NextResponse.json({ error: 'geo_lng out of range' }, { status: 400 });
    }

    // Re-auth teacher.
    const { data: teacher, error: tErr } = await supabaseAdmin
      .from('staff')
      .select('id, school_id, role, is_active')
      .eq('phone', body.phone)
      .eq('access_pin', body.pin)
      .eq('is_active', true)
      .single();

    if (tErr || !teacher) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    // Path-prefix guard: storage_path must start with <school_id>/<staff_id>/
    const expectedPrefix = `${teacher.school_id}/${teacher.id}/`;
    if (!body.storage_path.startsWith(expectedPrefix)) {
      return NextResponse.json({
        error: 'storage_path does not match your school/staff prefix',
      }, { status: 403 });
    }

    // Class assignment guard.
    const ttQuery = supabaseAdmin
      .from('timetable')
      .select('id')
      .eq('staff_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .eq('class_id', body.class_id);

    const { data: ttRows, error: ttErr } = body.period_id
      ? await ttQuery.eq('id', body.period_id).limit(1)
      : await ttQuery.limit(1);

    if (ttErr) {
      console.error('Timetable authorization lookup error:', ttErr);
      return NextResponse.json({ error: 'Failed to verify class assignment' }, { status: 500 });
    }
    if (!ttRows || ttRows.length === 0) {
      return NextResponse.json({
        error: 'You are not assigned to this class' + (body.period_id ? ' for this period' : ''),
      }, { status: 403 });
    }

    const takenAt = body.taken_at ?? new Date().toISOString();

    // INSERT classroom_proofs row.
    const insertPayload: Record<string, unknown> = {
      school_id: teacher.school_id,
      staff_id: teacher.id,
      class_id: body.class_id,
      period_id: body.period_id ?? null,
      photo_url: body.storage_path,
      taken_at: takenAt,
      audit_status: 'pending',
    };
    if (body.geo_lat !== undefined) insertPayload.geo_lat = body.geo_lat;
    if (body.geo_lng !== undefined) insertPayload.geo_lng = body.geo_lng;

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from('classroom_proofs')
      .insert(insertPayload)
      .select('id, taken_at, audit_status, retention_until')
      .single();

    if (iErr || !inserted) {
      console.error('Classroom proof INSERT error:', iErr);
      return NextResponse.json({ error: 'Failed to record proof' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      proof_id: inserted.id,
      taken_at: inserted.taken_at,
      audit_status: inserted.audit_status,
      retention_until: inserted.retention_until,
    });

  } catch (err) {
    console.error('Confirm error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
