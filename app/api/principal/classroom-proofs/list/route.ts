import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Principal lists classroom proofs for review.
// Auth: session cookie via getSchoolId.
//
// Query params:
//   - date=YYYY-MM-DD (default: today IST)
//   - include_expired=true (default: false; expired = photo_url='')
//
// Filter rules:
//   - school_id = principal's school
//   - taken_at within the requested IST date (half-open interval [day, day+1))
//   - photo_url != '' UNLESS include_expired=true
//
// Note: audit_status is the principal's MODERATION enum (pending/verified/flagged/rejected).
// It does NOT include 'expired'. photo_url='' is the canonical data-lifecycle marker
// for "auto-expired by retention cleanup". UI distinguishes these two axes.
//
// Each row gets a signed download URL valid 1 hour, generated server-side using the
// service-role key. Expired rows get null download_url.

const DOWNLOAD_URL_EXPIRY_SECONDS = 3600; // 1 hour

function todayInIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function tomorrowOf(dateStr: string): string {
  const tomorrowDate = new Date(new Date(`${dateStr}T00:00:00+05:30`).getTime() + 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(tomorrowDate);
}

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { searchParams } = new URL(req.url);

    const dateOverride = searchParams.get('date');
    const includeExpired = searchParams.get('include_expired') === 'true';

    let queryDate = todayInIST();
    if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
      queryDate = dateOverride;
    }
    const queryTomorrow = tomorrowOf(queryDate);
    const dayStart = `${queryDate}T00:00:00+05:30`;
    const dayEnd = `${queryTomorrow}T00:00:00+05:30`;

    // Build the proofs query.
    let q = supabaseAdmin
      .from('classroom_proofs')
      .select('id, staff_id, class_id, period_id, photo_url, taken_at, audit_status, audit_notes, geo_lat, geo_lng, retention_until')
      .eq('school_id', schoolId)
      .gte('taken_at', dayStart)
      .lt('taken_at', dayEnd)
      .order('taken_at', { ascending: false });

    if (!includeExpired) {
      q = q.neq('photo_url', '');
    }

    const { data: proofs, error: pErr } = await q;
    if (pErr) {
      console.error('Classroom proofs fetch error:', pErr);
      return NextResponse.json({ error: 'Failed to load proofs' }, { status: 500 });
    }

    if (!proofs || proofs.length === 0) {
      return NextResponse.json({ success: true, date: queryDate, proofs: [] });
    }

    // Hydrate staff names and class details.
    const staffIds = [...new Set(proofs.map(p => p.staff_id).filter(Boolean))];
    const classIds = [...new Set(proofs.map(p => p.class_id).filter(Boolean))];
    const periodIds = [...new Set(proofs.map(p => p.period_id).filter(Boolean))];

    const [staffRes, classesRes, periodsRes] = await Promise.all([
      staffIds.length > 0
        ? supabaseAdmin.from('staff').select('id, name, subject').in('id', staffIds)
        : Promise.resolve({ data: [], error: null }),
      classIds.length > 0
        ? supabaseAdmin.from('classes').select('id, grade_level, section').in('id', classIds)
        : Promise.resolve({ data: [], error: null }),
      periodIds.length > 0
        ? supabaseAdmin.from('timetable').select('id, period, start_time, end_time').in('id', periodIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const staffById = new Map((staffRes.data ?? []).map(s => [s.id, s]));
    const classById = new Map((classesRes.data ?? []).map(c => [c.id, c]));
    const periodById = new Map((periodsRes.data ?? []).map(p => [p.id, p]));

    // For each non-expired proof, generate a signed download URL in parallel.
    const downloadUrlPromises = proofs.map(async (p) => {
      if (!p.photo_url || p.photo_url === '') return null; // expired
      const { data, error } = await supabaseAdmin.storage
        .from('classroom-proofs')
        .createSignedUrl(p.photo_url, DOWNLOAD_URL_EXPIRY_SECONDS);
      if (error || !data) {
        console.error('createSignedUrl error for', p.photo_url, error);
        return null;
      }
      return data.signedUrl;
    });
    const downloadUrls = await Promise.all(downloadUrlPromises);

    const enriched = proofs.map((p, i) => {
      const teacher = p.staff_id ? staffById.get(p.staff_id) : null;
      const cls = p.class_id ? classById.get(p.class_id) : null;
      const per = p.period_id ? periodById.get(p.period_id) : null;
      const isExpired = !p.photo_url || p.photo_url === '';
      return {
        id: p.id,
        taken_at: p.taken_at,
        audit_status: p.audit_status,
        audit_notes: p.audit_notes,
        is_expired: isExpired,
        download_url: downloadUrls[i],
        retention_until: p.retention_until,
        geo_lat: p.geo_lat,
        geo_lng: p.geo_lng,
        teacher: teacher ? { id: teacher.id, name: teacher.name, subject: teacher.subject } : null,
        class: cls ? { id: cls.id, grade_level: cls.grade_level, section: cls.section } : null,
        period: per ? { id: per.id, period: per.period, start_time: per.start_time, end_time: per.end_time } : null,
      };
    });

    return NextResponse.json({
      success: true,
      date: queryDate,
      include_expired: includeExpired,
      total: enriched.length,
      proofs: enriched,
    });

  } catch (err) {
    console.error('Classroom proofs list error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
