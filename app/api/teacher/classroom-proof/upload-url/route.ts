import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { randomUUID } from 'crypto';

// Teacher requests a signed upload URL for a classroom proof photo.
// Auth: phone+PIN per request (Item 9 pattern).
//
// Server-side validation BEFORE issuing signed URL:
//   1. Teacher exists, active, role=teacher
//   2. content_type is whitelisted (image/jpeg, image/png, image/webp)
//   3. Teacher is assigned to the requested class via timetable (period_id check)
//
// Path convention: <school_id>/<staff_id>/<YYYYMMDD-IST>/<uuid>.<ext>
// Signed URL expiry: 5 minutes (300 seconds)
//
// Returns: { upload_url, storage_path, token, expires_at }
//
// Security: this route is the gate. Once a signed URL is issued, the client uploads
// directly to Supabase storage bypassing RLS. Therefore EVERY authorization check
// must happen in this route before createSignedUploadUrl is called.

interface UploadUrlRequest {
  phone: string;
  pin: string;
  class_id: string;
  period_id?: string;
  content_type: string;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

function todayInIST(): string {
  const now = new Date();
  // YYYYMMDD format for path readability.
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now); // returns YYYY-MM-DD
  return dateStr.replace(/-/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as UploadUrlRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!body.class_id || !UUID_RX.test(body.class_id)) {
      return NextResponse.json({ error: 'Valid class_id required' }, { status: 400 });
    }
    if (body.period_id && !UUID_RX.test(body.period_id)) {
      return NextResponse.json({ error: 'Invalid period_id format' }, { status: 400 });
    }
    if (!body.content_type || !CONTENT_TYPE_TO_EXT[body.content_type]) {
      return NextResponse.json({
        error: 'Invalid content_type. Must be image/jpeg, image/png, or image/webp',
      }, { status: 400 });
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
    if (teacher.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can upload classroom proofs' }, { status: 403 });
    }

    // Authorization: verify teacher is assigned to this class.
    // If period_id provided, the timetable row must match staff_id + class_id + school_id + period_id.
    // If only class_id provided, accept any timetable row that matches staff_id + class_id + school_id.
    const ttQuery = supabaseAdmin
      .from('timetable')
      .select('id, class_id, period, start_time, end_time')
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

    // Construct storage path. school_id and staff_id come from authenticated teacher,
    // not from request body — prevents cross-tenant injection.
    const ext = CONTENT_TYPE_TO_EXT[body.content_type];
    const datePart = todayInIST();
    const fileId = randomUUID();
    const storagePath = `${teacher.school_id}/${teacher.id}/${datePart}/${fileId}.${ext}`;

    // Issue signed upload URL.
    // Note: createSignedUploadUrl signature in supabase-js v2 returns { signedUrl, token, path }.
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from('classroom-proofs')
      .createSignedUploadUrl(storagePath);

    if (sErr || !signed) {
      console.error('createSignedUploadUrl error:', sErr);
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();

    return NextResponse.json({
      success: true,
      upload_url: signed.signedUrl,
      storage_path: storagePath,
      token: signed.token,
      content_type: body.content_type,
      expires_at: expiresAt,
      // Echo period info to help client display "for Period N".
      period_info: ttRows[0],
    });

  } catch (err) {
    console.error('Upload URL error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
