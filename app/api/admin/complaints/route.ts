import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task A: Admin complaint list.
// Auth: middleware session (x-school-id, x-user-role headers).
// Roles: owner | principal | admin_staff | admin | accountant (via requireAdminSession).
//
// GET query params:
//   - status: optional, filter by status (open|under_review|escalated|resolved|closed)
//   - type: optional, filter by complaint_type
//   - limit: default 50, max 200
//   - offset: default 0
//
// Returns complaints joined with student name + class for the calling admin's school only.

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set([
  'open', 'under_review', 'escalated', 'resolved', 'closed',
]);

const ALLOWED_TYPES = new Set([
  'academic', 'teacher_conduct', 'bullying', 'safety',
  'infrastructure', 'fee', 'transport', 'food', 'vendor', 'general',
]);

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
  const { schoolId } = ctx;

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');
  const typeFilter = searchParams.get('type');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  // Build query — tenant boundary via .eq('school_id') on the calling admin's school
  let q = supabaseAdmin
    .from('parent_complaints')
    .select(`
      id, complaint_type, subject, description, status, assigned_to,
      resolution, resolved_at, closed_at, created_at, updated_at,
      parent_phone, student_id,
      students:students!parent_complaints_student_id_fkey ( id, name, class, section )
    `, { count: 'exact' })
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter && ALLOWED_STATUSES.has(statusFilter)) {
    q = q.eq('status', statusFilter);
  }
  if (typeFilter && ALLOWED_TYPES.has(typeFilter)) {
    q = q.eq('complaint_type', typeFilter);
  }

  const { data, error, count } = await q;

  if (error) {
    console.error('Admin complaint list error:', error);
    return NextResponse.json({ error: 'Failed to load complaints' }, { status: 500 });
  }

  // Compute status counts for the admin dashboard
  const { data: counts } = await supabaseAdmin
    .from('parent_complaints')
    .select('status')
    .eq('school_id', schoolId);

  const stats = { open: 0, under_review: 0, escalated: 0, resolved: 0, closed: 0 };
  for (const row of counts ?? []) {
    const s = row.status as keyof typeof stats;
    if (s in stats) stats[s]++;
  }

  return NextResponse.json({
    success: true,
    total: count ?? 0,
    limit,
    offset,
    stats,
    complaints: data ?? [],
  });
}
