import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

// Parent fetches announcements relevant to their student.
// Auth: session cookie
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getParentSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schoolId, studentId } = session;
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Math.max(limitParam ? parseInt(limitParam, 10) : 20, 1), 50);

    // Resolve the student's class_id (text+section -> uuid via classes lookup).
    // Same pattern as login route.
    const { data: student, error: sErr } = await supabaseAdmin
      .from('students')
      .select('class, section')
      .eq('id', studentId)
      .eq('school_id', schoolId)
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
        .eq('school_id', schoolId)
        .eq('grade_level', student.class)
        .eq('section', student.section)
        .maybeSingle();
      if (classRow) studentClassId = classRow.id;
    }

    // Fetch announcements where target_audience contains 'parent' AND school matches.
    const { data: announcements, error: aErr } = await supabaseAdmin
      .from('announcements')
      .select('id, title, message, target_classes, target_audience, scheduled_at, sent_at, created_at')
      .eq('school_id', schoolId)
      .or('target_audience.cs.{parent},target_audience.cs.{parents}')
      .order('scheduled_at', { ascending: false })
      .limit(limit);

    if (aErr) {
      console.error('Announcements query error:', aErr);
      return NextResponse.json({ error: 'Failed to load announcements' }, { status: 500 });
    }

    // JS-side class filter:
    const filtered = (announcements ?? []).filter(a => {
      const targets = a.target_classes;
      const isSchoolWide = !Array.isArray(targets) || targets.length === 0;
      if (isSchoolWide) return true;
      if (studentClassId === null) return false;
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
        subject: a.title, // Add for compatibility with parent notice page interface
        message: a.message,
        created_at: a.created_at,
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
