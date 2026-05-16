import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';

// PR-2 Task A: Admin/principal lists all complaints for their school.
// Auth: middleware-injected session (owner/admin/principal/accountant).
// Filters: ?status=open|under_review|escalated|resolved|closed (optional)
//          ?type=academic|teacher_conduct|...|general (optional)
// Joined with students (name, class, section) for display.

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdminSession(req);
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');

    let q = supabaseAdmin
      .from('parent_complaints')
      .select(`
        id, complaint_type, subject, description, status,
        parent_phone, assigned_to, resolution,
        resolved_at, closed_at, created_at, updated_at,
        student:students!parent_complaints_student_id_fkey(id, name, class, section)
      `)
      .eq('school_id', ctx.schoolId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (status) q = q.eq('status', status);
    if (type) q = q.eq('complaint_type', type);

    const { data, error } = await q;
    if (error) {
      console.error('[admin-complaints] query error:', error);
      return NextResponse.json({ error: 'Failed to load complaints' }, { status: 500 });
    }

    // Stats for dashboard pill
    const byStatus: Record<string, number> = {
      open: 0, under_review: 0, escalated: 0, resolved: 0, closed: 0,
    };
    for (const row of data ?? []) {
      if (row.status in byStatus) byStatus[row.status]++;
    }

    return NextResponse.json({
      success: true,
      total: data?.length ?? 0,
      stats: byStatus,
      complaints: data ?? [],
    });

  } catch (err) {
    console.error('[admin-complaints] GET error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
