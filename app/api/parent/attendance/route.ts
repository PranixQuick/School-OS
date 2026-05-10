import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Parent fetches their student's attendance.
// Auth: phone+PIN per request.
//
// Body: {
//   phone, pin: required
//   from_date?: YYYY-MM-DD  (default: today - days param, in IST)
//   to_date?: YYYY-MM-DD    (default: today in IST)
//   days?: number           (default 30; ignored if from_date+to_date both provided)
// }
//
// Status enum (DB CHECK): present | absent | late | excused.
//
// Returns:
//   - rows: per-day attendance records in range, ordered date DESC
//   - summary: counts per status
//   - present_pct: present / (present + absent + late) as a percentage
//     (excused excluded from denominator — typical reporting convention)

interface AttRequest {
  phone?: string;
  pin?: string;
  from_date?: string;
  to_date?: string;
  days?: number;
}

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function shiftDateIST(daysFromToday: number): string {
  const past = new Date(Date.now() + daysFromToday * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(past);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AttRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (body.from_date && !DATE_RX.test(body.from_date)) {
      return NextResponse.json({ error: 'Invalid from_date format (YYYY-MM-DD)' }, { status: 400 });
    }
    if (body.to_date && !DATE_RX.test(body.to_date)) {
      return NextResponse.json({ error: 'Invalid to_date format (YYYY-MM-DD)' }, { status: 400 });
    }
    const days = body.days !== undefined ? Math.min(Math.max(body.days, 1), 365) : 30;

    // Resolve date range:
    //   - if both from+to provided: use them
    //   - else: default to (today - days, today) in IST
    const toDate = body.to_date ?? todayIST();
    const fromDate = body.from_date ?? shiftDateIST(-days + 1);  // inclusive range

    if (fromDate > toDate) {
      return NextResponse.json({ error: 'from_date cannot be after to_date' }, { status: 400 });
    }

    // Re-auth parent (multi-tenant guard).
    const { data: parents, error: pErr } = await supabaseAdmin
      .from('parents')
      .select('id, school_id, student_id')
      .eq('phone', body.phone)
      .eq('access_pin', body.pin);

    if (pErr) {
      console.error('Parent lookup error:', pErr);
      return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 });
    }
    if (!parents || parents.length === 0) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }
    if (parents.length > 1) {
      return NextResponse.json({
        error: 'Multiple accounts match this phone. Please contact your school admin.',
      }, { status: 409 });
    }
    const parent = parents[0];

    // Fetch attendance rows for this student in the date range.
    const { data: rows, error: aErr } = await supabaseAdmin
      .from('attendance')
      .select('id, date, status, marked_via, created_at')
      .eq('student_id', parent.student_id)
      .eq('school_id', parent.school_id)  // cross-tenant guard
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false })
      .limit(500);

    if (aErr) {
      console.error('Attendance query error:', aErr);
      return NextResponse.json({ error: 'Failed to load attendance' }, { status: 500 });
    }

    const attendance = rows ?? [];

    // Summary counts. Valid statuses: present, absent, late, excused.
    const summary = {
      present: attendance.filter(r => r.status === 'present').length,
      absent: attendance.filter(r => r.status === 'absent').length,
      late: attendance.filter(r => r.status === 'late').length,
      excused: attendance.filter(r => r.status === 'excused').length,
    };

    // Present % calculation: (present) / (present + absent + late)
    // Excused intentionally excluded from denominator (excused = "approved absence,
    // doesn't count against attendance %") — standard school reporting convention.
    const counted = summary.present + summary.absent + summary.late;
    const presentPct = counted > 0 ? Math.round((summary.present / counted) * 100) : null;

    return NextResponse.json({
      success: true,
      from_date: fromDate,
      to_date: toDate,
      days_in_range: days,
      total: attendance.length,
      summary,
      present_pct: presentPct,  // null if no countable rows in range
      attendance,
    });

  } catch (err) {
    console.error('Parent attendance error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
