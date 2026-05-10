import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Parent fetches announcements relevant to their student.
// Auth: phone+PIN per request.
//
// Body: { phone, pin, limit?: number (default 20, max 50) }
//
// Strict filter (PRE-FLIGHT-E):
//   - announcement.target_audience must CONTAIN 'parent'
//   - AND (target_classes is empty OR student's class.id is IN target_classes)
//
// Implementation note: Postgres array operators work natively, but we do the
// "target_audience contains 'parent'" filter via .contains(), and the class
// match is done in JS after fetching school-wide candidates (typically small N).
//
// Order by scheduled_at DESC, default limit 20 (max 50).

interface AnnRequest {
  phone?: string;
  pin?: string;
  limit?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AnnRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);

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

    // Resolve the student's class_id (text+section -> uuid via classes lookup).
    // Same pattern as login route.
    const { data: student, error: sErr } = await supabaseAdmin
      .from('students')
      .select('class, section')
      .eq('id', parent.student_id)
      .eq('school_id', parent.school_id)
      .single();

    if (sErr || !student) {
      console.error('Student lookup error:', sErr);
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    let studentClassId: string | null = null;
    if (student.class && student.section) {
      const { data: classRow } = await supabaseAdmin
        .from('classes')
        .select('id')
        .eq('school_id', parent.school_id)
        .eq('grade_level', student.class)
        .eq('section', student.section)
        .maybeSingle();
      if (classRow) studentClassId = classRow.id;
    }

    // Fetch announcements where target_audience contains 'parent' AND school matches.
    // Postgres array contains: .contains('target_audience', ['parent']).
    const { data: announcements, error: aErr } = await supabaseAdmin
      .from('announcements')
      .select('id, title, message, target_classes, target_audience, scheduled_at, sent_at, created_at')
      .eq('school_id', parent.school_id)
      .contains('target_audience', ['parent'])
      .order('scheduled_at', { ascending: false })
      .limit(limit);

    if (aErr) {
      console.error('Announcements query error:', aErr);
      return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 });
    }

    // JS-side class filter:
    //   - target_classes is null OR empty array -> school-wide, applies to all
    //   - target_classes contains studentClassId -> applies
    //   - else: doesn't apply
    //
    // Edge case: if studentClassId is null (classes table doesn't have a row for
    // this student's grade/section), only show school-wide announcements.
    const filtered = (announcements ?? []).filter(a => {
      const targets = a.target_classes;
      const isSchoolWide = !Array.isArray(targets) || targets.length === 0;
      if (isSchoolWide) return true;
      if (studentClassId === null) return false;  // class-targeted, but no class.id resolved
      return targets.includes(studentClassId);
    });

    return NextResponse.json({
      success: true,
      total: filtered.length,
      filter_strategy: 'parent_audience_and_class_match',
      class_id_resolved: studentClassId,
      announcements: filtered.map(a => ({
        id: a.id,
        title: a.title,
        message: a.message,
        scheduled_at: a.scheduled_at,
        sent_at: a.sent_at,
        is_school_wide: !Array.isArray(a.target_classes) || a.target_classes.length === 0,
      })),
    });

  } catch (err) {
    console.error('Parent announcements error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
