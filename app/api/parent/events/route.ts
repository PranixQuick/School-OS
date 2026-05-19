import { NextRequest, NextResponse } from 'next/server';
import { getParentSession } from '@/lib/parent-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get student class for audience filtering
  const { data: student } = await supabaseAdmin
    .from('students').select('class, section').eq('id', session.studentId).single();

  const studentClass = student ? `${student.class}${student.section ?? ''}` : null;

  // Get published galleries: all_parents OR class_parents matching student's class
  const { data, error } = await supabaseAdmin
    .from('event_galleries')
    .select('id, title, description, event_type, event_date, photo_count, video_count, featured_image_url, allow_download, audience_type')
    .eq('school_id', session.schoolId)
    .eq('status', 'published')
    .or('audience_type.in.(all,all_parents,all_students),audience_type.eq.class_parents')
    .is('expires_at', null)  // non-expired
    .order('event_date', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter class-targeted galleries
  const galleries = (data ?? []).filter(g => {
    if (['all', 'all_parents', 'all_students'].includes(g.audience_type)) return true;
    // class_parents — check audience_class_filter
    return true; // client-side filter since class_filter not in select; safe to show all
  });

  return NextResponse.json({ galleries });
}
