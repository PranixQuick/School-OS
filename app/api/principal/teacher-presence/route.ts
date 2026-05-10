import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Principal fetches today's teacher presence summary.
// Auth: session cookie (middleware sets x-school-id header).
//
// Computes 4 buckets per teacher:
//   - scheduled_today: teacher has a timetable row for today (IST day-of-week)
//   - has_inside_ping: teacher has at least one teacher_geo_pings row today with inside_polygon=true
//   - has_late_event: teacher has at least one teacher_late_events row today
//   - missed: scheduled_today AND no inside ping AND no late event yet (the "where are they?" bucket)
//
// Aggregation is pure JS — 4 parallel Supabase queries, then a JS join.
// No new schema, no view, no RPC.

// IST-explicit "today" helper. Same as checkin route's nowInIST().
function todayInIST(): { dateStr: string; tomorrowStr: string; dow: number } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const tomorrowDate = new Date(new Date(`${dateStr}T00:00:00+05:30`).getTime() + 86400000);
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(tomorrowDate);
  const dowName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', weekday: 'short',
  }).format(now);
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dowName);
  return { dateStr, tomorrowStr, dow };
}

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { searchParams } = new URL(req.url);
    // Allow override via ?date=YYYY-MM-DD (admin/QA usage). Default = today IST.
    const dateOverride = searchParams.get('date');
    const { dateStr: defaultToday, tomorrowStr: defaultTomorrow, dow: defaultDow } = todayInIST();

    let queryDate = defaultToday;
    let queryTomorrow = defaultTomorrow;
    let queryDow = defaultDow;
    if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
      queryDate = dateOverride;
      const tomorrow = new Date(new Date(`${dateOverride}T00:00:00+05:30`).getTime() + 86400000);
      queryTomorrow = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(tomorrow);
      const dowName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', weekday: 'short',
      }).format(new Date(`${dateOverride}T00:00:00+05:30`));
      queryDow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dowName);
    }

    const dayStart = `${queryDate}T00:00:00+05:30`;
    const dayEnd = `${queryTomorrow}T00:00:00+05:30`;

    // 4 parallel queries.
    const [staffRes, scheduledRes, pingsRes, lateRes] = await Promise.all([
      // All active teaching staff for this school.
      supabaseAdmin.from('staff')
        .select('id, name, role, subject, phone')
        .eq('school_id', schoolId)
        .eq('is_active', true),

      // Distinct teacher staff_ids with timetable entries today.
      supabaseAdmin.from('timetable')
        .select('staff_id')
        .eq('school_id', schoolId)
        .eq('day_of_week', queryDow)
        .not('staff_id', 'is', null),

      // teacher_geo_pings for today, with inside_polygon flag.
      supabaseAdmin.from('teacher_geo_pings')
        .select('staff_id, inside_polygon, ping_at')
        .eq('school_id', schoolId)
        .gte('ping_at', dayStart)
        .lt('ping_at', dayEnd),

      // teacher_late_events for today (by expected_at).
      supabaseAdmin.from('teacher_late_events')
        .select('staff_id, expected_at, delta_minutes, scheduled_period_id')
        .eq('school_id', schoolId)
        .gte('expected_at', dayStart)
        .lt('expected_at', dayEnd),
    ]);

    if (staffRes.error)     return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
    if (scheduledRes.error) return NextResponse.json({ error: 'Failed to load timetable' }, { status: 500 });
    if (pingsRes.error)     return NextResponse.json({ error: 'Failed to load pings' }, { status: 500 });
    if (lateRes.error)      return NextResponse.json({ error: 'Failed to load late events' }, { status: 500 });

    // Aggregate.
    const scheduledSet = new Set<string>();
    for (const row of scheduledRes.data ?? []) {
      if (row.staff_id) scheduledSet.add(row.staff_id);
    }

    const insidePingByStaff = new Map<string, { count: number; firstAt: string | null }>();
    const anyPingByStaff = new Set<string>();
    for (const p of pingsRes.data ?? []) {
      anyPingByStaff.add(p.staff_id);
      if (p.inside_polygon === true) {
        const cur = insidePingByStaff.get(p.staff_id) ?? { count: 0, firstAt: null };
        cur.count += 1;
        if (!cur.firstAt || p.ping_at < cur.firstAt) cur.firstAt = p.ping_at;
        insidePingByStaff.set(p.staff_id, cur);
      }
    }

    const lateByStaff = new Map<string, { count: number; maxDelta: number }>();
    for (const e of lateRes.data ?? []) {
      const cur = lateByStaff.get(e.staff_id) ?? { count: 0, maxDelta: 0 };
      cur.count += 1;
      if ((e.delta_minutes ?? 0) > cur.maxDelta) cur.maxDelta = e.delta_minutes ?? 0;
      lateByStaff.set(e.staff_id, cur);
    }

    const teachers = (staffRes.data ?? []).map(s => {
      const scheduled = scheduledSet.has(s.id);
      const insidePing = insidePingByStaff.get(s.id);
      const late = lateByStaff.get(s.id);
      const anyPing = anyPingByStaff.has(s.id);
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        subject: s.subject,
        scheduled_today: scheduled,
        any_ping_today: anyPing,
        inside_ping_count: insidePing?.count ?? 0,
        first_inside_ping_at: insidePing?.firstAt ?? null,
        late_event_count: late?.count ?? 0,
        max_late_minutes: late?.maxDelta ?? 0,
        // Status buckets for UI:
        status: scheduled
          ? (insidePing
              ? (late ? 'late_present' : 'present')
              : (late ? 'late_no_ping' : (anyPing ? 'outside_zone' : 'no_show')))
          : (insidePing ? 'unscheduled_present' : (anyPing ? 'unscheduled_outside' : 'not_scheduled')),
      };
    });

    // Sort: scheduled-but-no-show first (most urgent), then late events, then present, then not scheduled.
    const STATUS_RANK: Record<string, number> = {
      no_show: 0,
      late_no_ping: 1,
      outside_zone: 2,
      late_present: 3,
      present: 4,
      unscheduled_present: 5,
      unscheduled_outside: 6,
      not_scheduled: 7,
    };
    teachers.sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99));

    return NextResponse.json({
      success: true,
      date: queryDate,
      day_of_week: queryDow,
      summary: {
        total_staff: teachers.length,
        scheduled_today: teachers.filter(t => t.scheduled_today).length,
        present: teachers.filter(t => t.status === 'present' || t.status === 'late_present').length,
        late: teachers.filter(t => t.late_event_count > 0).length,
        no_show: teachers.filter(t => t.status === 'no_show').length,
      },
      teachers,
    });

  } catch (err) {
    console.error('Teacher presence error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
